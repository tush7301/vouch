"""
Feed endpoint – returns a personalised feed for the authenticated user.

Feed composition (interleaved):
  1. **Friend activity** – Recent ratings from people the user follows.
  2. **Vouch Picks** – Top-rated experiences in the user's selected categories.
  3. **Trending** – Experiences with the most recent ratings across all users.

Cursor-based pagination keyed on the *last rating's created_at* timestamp.
"""

from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, desc
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user, get_current_user_optional
from app.database import get_db
from app.models.experience import Experience
from app.models.follow import Follow
from app.models.rating import Rating
from app.models.user import User
from app.schemas.schemas import (
    ExperienceOut,
    FeedItem,
    FeedRating,
    FeedResponse,
    FollowUserOut,
)

router = APIRouter(prefix="/feed", tags=["feed"])

PAGE_SIZE = 20


def _time_ago(dt: datetime) -> str:
    """Human-readable relative time string."""
    delta = datetime.utcnow() - dt
    seconds = int(delta.total_seconds())
    if seconds < 60:
        return "just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    if days < 7:
        return f"{days}d ago"
    weeks = days // 7
    if weeks < 4:
        return f"{weeks}w ago"
    return dt.strftime("%b %d")


def _rating_to_feed_rating(r: Rating) -> FeedRating:
    return FeedRating(
        id=r.id,
        user_id=r.user_id,
        experience_id=r.experience_id,
        vibe_score=r.vibe_score,
        value_score=r.value_score,
        experience_score=r.experience_score,
        overall_score=r.overall_score,
        review_text=r.review_text or "",
        tags=r.tags or "",
        photo_urls=r.photo_urls or "",
        created_at=r.created_at,
    )


def _user_to_follow_user(u: User) -> FollowUserOut:
    return FollowUserOut(
        id=u.id,
        username=u.username,
        display_name=u.display_name,
        avatar_url=u.avatar_url or "",
    )


def _experience_to_out(e: Experience) -> ExperienceOut:
    return ExperienceOut(
        id=e.id,
        name=e.name,
        category=e.category,
        subcategory=e.subcategory or "",
        address=e.address or "",
        neighborhood=e.neighborhood or "",
        latitude=e.latitude,
        longitude=e.longitude,
        tags=e.tags or "",
        description=e.description or "",
        is_event=e.is_event or False,
        cover_photo_url=e.cover_photo_url or "",
        photo_urls=e.photo_urls or "",
        google_place_id=e.google_place_id,
        ticketmaster_id=e.ticketmaster_id,
        event_date=e.event_date,
        created_at=e.created_at,
    )


# ── helpers ─────────────────────────────────────────────────────

def _friend_activity(
    db: Session, user_id: UUID, before: datetime | None, limit: int
) -> list[FeedItem]:
    """Recent ratings from people I follow."""
    following_ids = (
        db.query(Follow.following_id)
        .filter(Follow.follower_id == user_id)
        .scalar_subquery()
    )

    q = (
        db.query(Rating)
        .options(joinedload(Rating.user), joinedload(Rating.experience))
        .filter(Rating.user_id.in_(following_ids))
    )
    if before:
        q = q.filter(Rating.created_at < before)
    rows = q.order_by(desc(Rating.created_at)).limit(limit).all()

    items: list[FeedItem] = []
    for r in rows:
        items.append(
            FeedItem(
                type="friend_activity",
                rating=_rating_to_feed_rating(r),
                experience=_experience_to_out(r.experience),
                user=_user_to_follow_user(r.user),
                time_ago=_time_ago(r.created_at),
            )
        )
    return items


def _vouch_picks(
    db: Session,
    user: User,
    exclude_ids: set[UUID],
    limit: int,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float = 50.0,
) -> list[FeedItem]:
    """Top-rated experiences in the user's preferred categories, optionally near a location."""
    import math
    cats = [c.strip() for c in (user.selected_categories or "").split(",") if c.strip()]

    q = (
        db.query(
            Experience,
            func.avg(Rating.overall_score).label("avg_score"),
            func.count(Rating.id).label("num_ratings"),
        )
        .join(Rating, Rating.experience_id == Experience.id)
        .group_by(Experience.id)
        .having(func.count(Rating.id) >= 1)
    )
    if cats:
        q = q.filter(Experience.category.in_(cats))
    if exclude_ids:
        q = q.filter(~Experience.id.in_(exclude_ids))
    if lat is not None and lng is not None:
        lat_delta = radius_km / 111.0
        lng_delta = radius_km / (111.0 * math.cos(math.radians(lat)))
        q = q.filter(
            Experience.latitude >= lat - lat_delta,
            Experience.latitude <= lat + lat_delta,
            Experience.longitude >= lng - lng_delta,
            Experience.longitude <= lng + lng_delta,
        )

    rows = q.order_by(desc("avg_score")).limit(limit).all()

    items: list[FeedItem] = []
    for exp, avg_score, num_ratings in rows:
        # Pick the highest-rated individual rating for display
        top_rating = (
            db.query(Rating)
            .options(joinedload(Rating.user))
            .filter(Rating.experience_id == exp.id)
            .order_by(desc(Rating.overall_score))
            .first()
        )
        items.append(
            FeedItem(
                type="vouch_pick",
                rating=_rating_to_feed_rating(top_rating) if top_rating else None,
                experience=_experience_to_out(exp),
                user=_user_to_follow_user(top_rating.user) if top_rating else None,
                time_ago=f"{round(avg_score, 1)} avg · {num_ratings} rating{'s' if num_ratings != 1 else ''}",
            )
        )
    return items


def _trending(
    db: Session,
    exclude_ids: set[UUID],
    limit: int,
    user: User | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float = 50.0,
) -> list[FeedItem]:
    """Experiences with the most ratings in the last 30 days.

    When `user` has `selected_categories`, we restrict to those — otherwise
    "trending" drowns a Food user's feed with nightclub vouches. Likewise
    lat/lng scopes trending to the user's city so Tokyo nightlife doesn't
    surface to an NYC user's For You tab.
    """
    import math

    since = datetime.utcnow() - timedelta(days=30)

    q = (
        db.query(
            Experience,
            func.count(Rating.id).label("num_ratings"),
            func.avg(Rating.overall_score).label("avg_score"),
        )
        .join(Rating, Rating.experience_id == Experience.id)
        .filter(Rating.created_at >= since)
        .group_by(Experience.id)
    )
    if exclude_ids:
        q = q.filter(~Experience.id.in_(exclude_ids))

    if user:
        cats = [c.strip() for c in (user.selected_categories or "").split(",") if c.strip()]
        if cats:
            q = q.filter(Experience.category.in_(cats))

    if lat is not None and lng is not None:
        lat_delta = radius_km / 111.0
        lng_delta = radius_km / (111.0 * math.cos(math.radians(lat)))
        q = q.filter(
            Experience.latitude.between(lat - lat_delta, lat + lat_delta),
            Experience.longitude.between(lng - lng_delta, lng + lng_delta),
        )

    rows = q.order_by(desc("num_ratings"), desc("avg_score")).limit(limit).all()

    items: list[FeedItem] = []
    for exp, num_ratings, avg_score in rows:
        latest_rating = (
            db.query(Rating)
            .options(joinedload(Rating.user))
            .filter(Rating.experience_id == exp.id)
            .order_by(desc(Rating.created_at))
            .first()
        )
        items.append(
            FeedItem(
                type="trending",
                rating=_rating_to_feed_rating(latest_rating) if latest_rating else None,
                experience=_experience_to_out(exp),
                user=_user_to_follow_user(latest_rating.user) if latest_rating else None,
                time_ago=f"🔥 {num_ratings} rating{'s' if num_ratings != 1 else ''} · {round(avg_score, 1)} avg",
            )
        )
    return items


# ── main endpoint ───────────────────────────────────────────────

@router.get("/", response_model=FeedResponse)
def get_feed(
    cursor: str | None = Query(None, description="ISO timestamp cursor for pagination"),
    category: str | None = Query(None, description="Optional category filter"),
    lat: float | None = Query(None, description="Latitude for location-aware Vouch Picks"),
    lng: float | None = Query(None, description="Longitude for location-aware Vouch Picks"),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Personalised feed for authenticated user.
    Returns friend activity, Vouch Picks, and trending items – interleaved.
    """
    before: datetime | None = None
    if cursor:
        try:
            before = datetime.fromisoformat(cursor)
        except ValueError:
            before = None

    items: list[FeedItem] = []
    seen_experience_ids: set[UUID] = set()

    if current_user:
        # 1. Friend activity (main section)
        friend_items = _friend_activity(db, current_user.id, before, limit=PAGE_SIZE)
        if category:
            friend_items = [fi for fi in friend_items if fi.experience and fi.experience.category == category]
        items.extend(friend_items)
        seen_experience_ids.update(fi.experience.id for fi in friend_items if fi.experience)

        # 2. Vouch Picks — location-aware, exclude experiences already seen
        pick_limit = max(6, PAGE_SIZE - len(friend_items))
        picks = _vouch_picks(db, current_user, seen_experience_ids, limit=pick_limit, lat=lat, lng=lng)
        if category:
            picks = [p for p in picks if p.experience and p.experience.category == category]
        seen_experience_ids.update(p.experience.id for p in picks if p.experience)
    else:
        picks = []

    # 3. Trending — exclude experiences already seen in friend activity + picks.
    # Filtered by the user's selected categories + their city so new users
    # don't see e.g. Tokyo nightlife in a "For You" feed.
    trend_limit = max(3, PAGE_SIZE - len(items) - len(picks))
    trending_items = _trending(
        db,
        seen_experience_ids,
        limit=trend_limit,
        user=current_user,
        lat=lat,
        lng=lng,
    )
    if category:
        trending_items = [t for t in trending_items if t.experience and t.experience.category == category]

    # Interleave: friend, friend, friend, friend, friend, PICK, friend, friend, friend, friend, friend, PICK, ... TRENDING
    final: list[FeedItem] = []
    pick_iter = iter(picks)
    friend_count = 0
    for fi in items:
        final.append(fi)
        friend_count += 1
        if friend_count % 5 == 0:
            pick = next(pick_iter, None)
            if pick:
                final.append(pick)

    # Append remaining picks
    for pick in pick_iter:
        final.append(pick)

    # Append trending at the end
    final.extend(trending_items)

    # Determine next cursor from the last friend_activity item
    friend_items_in_final = [fi for fi in final if fi.type == "friend_activity"]
    next_cursor = None
    if friend_items_in_final and len(friend_items_in_final) >= PAGE_SIZE:
        last = friend_items_in_final[-1]
        if last.rating:
            next_cursor = last.rating.created_at.isoformat()

    return FeedResponse(items=final, next_cursor=next_cursor)
