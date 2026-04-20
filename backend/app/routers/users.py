import math
import os
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.schemas.schemas import UserOut, UserUpdate, ProfileStatsOut, ProfileRatingOut, FollowUserOut
from app.models.user import User
from app.models.rating import Rating
from app.models.experience import Experience
from app.models.follow import Follow
from app.models.wishlist import Wishlist

router = APIRouter(prefix="/users", tags=["users"])


# ── Tastemaker schemas ──
class TastemakerOut(BaseModel):
    id: str
    username: str
    display_name: str
    avatar_url: str
    tastemaker_specialty: str
    tastemaker_blurb: str
    follower_count: int
    rating_count: int
    is_following: bool = False

    class Config:
        from_attributes = True


class TastemakerPromotePayload(BaseModel):
    username: str
    specialty: str
    blurb: str
    secret: str


@router.get("/me", response_model=UserOut)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get the currently authenticated user."""
    return current_user


# IMPORTANT: must be registered BEFORE /{user_id} or FastAPI will route
# `/users/tastemakers` to get_user(user_id="tastemakers").
@router.get("/tastemakers", response_model=List[TastemakerOut])
def list_tastemakers(
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List curated tastemaker accounts. Surfaced to new users to solve cold-start —
    even with 0 friends, you have high-signal people to follow from day 1.
    Sorted by follower count desc, then rating count desc.
    """
    rows = (
        db.query(
            User,
            func.count(func.distinct(Follow.id)).label("followers"),
            func.count(func.distinct(Rating.id)).label("ratings"),
        )
        .outerjoin(Follow, Follow.following_id == User.id)
        .outerjoin(Rating, Rating.user_id == User.id)
        .filter(User.is_tastemaker == True, User.is_active == True)
        .group_by(User.id)
        .order_by(func.count(func.distinct(Follow.id)).desc(), func.count(func.distinct(Rating.id)).desc())
        .limit(limit)
        .all()
    )
    if not rows:
        return []

    # Bulk follow-state lookup for current user
    tm_ids = [u.id for u, _, _ in rows]
    my_following = {
        str(f.following_id)
        for f in db.query(Follow)
        .filter(Follow.follower_id == current_user.id, Follow.following_id.in_(tm_ids))
        .all()
    }

    return [
        TastemakerOut(
            id=str(u.id),
            username=u.username,
            display_name=u.display_name,
            avatar_url=u.avatar_url or "",
            tastemaker_specialty=u.tastemaker_specialty or "",
            tastemaker_blurb=u.tastemaker_blurb or "",
            follower_count=int(followers or 0),
            rating_count=int(ratings or 0),
            is_following=str(u.id) in my_following,
        )
        for u, followers, ratings in rows
    ]


@router.post("/admin/promote-tastemaker", response_model=UserOut)
def promote_tastemaker(payload: TastemakerPromotePayload, db: Session = Depends(get_db)):
    """
    Promote a user to tastemaker status. Gated by ADMIN_SECRET env var.
    One-shot endpoint used by the seed script.
    """
    expected = os.getenv("ADMIN_SECRET", "")
    if not expected or payload.secret != expected:
        raise HTTPException(status_code=403, detail="Forbidden")

    user = db.query(User).filter(User.username == payload.username).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{payload.username}' not found")

    user.is_tastemaker = True
    user.tastemaker_specialty = payload.specialty[:100]
    user.tastemaker_blurb = payload.blurb[:300]
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: str, db: Session = Depends(get_db)):
    """Get a user by ID."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/me", response_model=UserOut)
def update_current_user(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the currently authenticated user profile."""
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/{user_id}/stats", response_model=ProfileStatsOut)
def get_user_stats(user_id: str, db: Session = Depends(get_db)):
    """Get aggregated stats for a user profile."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    rating_count = db.query(func.count(Rating.id)).filter(Rating.user_id == user_id).scalar()
    follower_count = db.query(func.count(Follow.id)).filter(Follow.following_id == user_id).scalar()
    following_count = db.query(func.count(Follow.id)).filter(Follow.follower_id == user_id).scalar()
    wishlist_count = db.query(func.count(Wishlist.id)).filter(Wishlist.user_id == user_id).scalar()
    avg_score = db.query(func.avg(Rating.overall_score)).filter(Rating.user_id == user_id).scalar()

    return ProfileStatsOut(
        rating_count=rating_count,
        follower_count=follower_count,
        following_count=following_count,
        wishlist_count=wishlist_count,
        avg_overall_score=round(avg_score, 1) if avg_score else None,
    )


@router.get("/{user_id}/ratings", response_model=list[ProfileRatingOut])
def get_user_ratings_enriched(
    user_id: str,
    db: Session = Depends(get_db),
):
    """Get all ratings for a user with experience name/category/photo/address."""
    rows = (
        db.query(
            Rating,
            Experience.name,
            Experience.category,
            Experience.cover_photo_url,
            Experience.address,
            Experience.neighborhood,
        )
        .join(Experience, Rating.experience_id == Experience.id)
        .filter(Rating.user_id == user_id)
        .order_by(Rating.created_at.desc())
        .all()
    )
    result = []
    for rating, exp_name, exp_category, exp_photo, exp_address, exp_neighborhood in rows:
        result.append(ProfileRatingOut(
            id=rating.id,
            user_id=rating.user_id,
            experience_id=rating.experience_id,
            experience_name=exp_name,
            experience_category=exp_category,
            experience_cover_photo=exp_photo or "",
            experience_address=exp_address or "",
            experience_neighborhood=exp_neighborhood or "",
            vibe_score=rating.vibe_score,
            value_score=rating.value_score,
            experience_score=rating.experience_score,
            overall_score=rating.overall_score,
            review_text=rating.review_text or "",
            tags=rating.tags or "",
            created_at=rating.created_at,
        ))
    return result


@router.post("/me/onboarding", response_model=UserOut)
def complete_onboarding(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Complete onboarding — saves selected categories and marks onboarding done.
    Called at the end of the onboarding flow.
    """
    if payload.selected_categories is not None:
        current_user.selected_categories = payload.selected_categories
    current_user.onboarding_complete = True
    db.commit()
    db.refresh(current_user)
    return current_user
