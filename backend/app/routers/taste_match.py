"""
Taste Match router — compute similarity between users based on shared rating overlap.

Algorithm: For each experience both users rated, compute per-axis similarity
  axis_sim = 1 - abs(score_a - score_b) / 10
Average across the three axes (vibe/value/experience) per overlap, then average
across all overlaps. Returned as percentage (0-100).

Requires at least 1 overlapping rating to return a meaningful score.
"""
from typing import List, Optional
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.rating import Rating
from app.models.follow import Follow

router = APIRouter(prefix="/taste-match", tags=["taste-match"])


# ── Schemas ──
class TasteTwinOut(BaseModel):
    id: str
    username: str
    display_name: str
    avatar_url: str
    match_percent: int
    overlap_count: int
    is_following: bool
    is_mutual: bool
    is_tastemaker: bool = False
    tastemaker_specialty: str = ""


class TasteMatchOut(BaseModel):
    user_id: str
    match_percent: Optional[int]
    overlap_count: int


# ── Helpers ──
def _compute_match(my_ratings_by_exp: dict, other_ratings: List[Rating]) -> tuple[Optional[int], int]:
    """Returns (match_percent, overlap_count). match_percent is None if no overlap."""
    overlaps = 0
    total_sim = 0.0
    for r in other_ratings:
        eid = str(r.experience_id)
        mine = my_ratings_by_exp.get(eid)
        if not mine:
            continue
        # Per-axis similarity averaged
        axes_sim = (
            (1 - abs(mine.vibe_score - r.vibe_score) / 10)
            + (1 - abs(mine.value_score - r.value_score) / 10)
            + (1 - abs(mine.experience_score - r.experience_score) / 10)
        ) / 3
        total_sim += max(0.0, axes_sim)
        overlaps += 1
    if overlaps == 0:
        return None, 0
    return int(round((total_sim / overlaps) * 100)), overlaps


# ── Endpoints ──
@router.get("/with/{user_id}", response_model=TasteMatchOut)
def match_with_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return taste-match percentage between the current user and a target user."""
    if str(current_user.id) == user_id:
        return TasteMatchOut(user_id=user_id, match_percent=100, overlap_count=0)

    my_ratings = db.query(Rating).filter(Rating.user_id == current_user.id).all()
    if not my_ratings:
        return TasteMatchOut(user_id=user_id, match_percent=None, overlap_count=0)

    my_by_exp = {str(r.experience_id): r for r in my_ratings}
    other_ratings = db.query(Rating).filter(Rating.user_id == user_id).all()
    pct, overlap = _compute_match(my_by_exp, other_ratings)
    return TasteMatchOut(user_id=user_id, match_percent=pct, overlap_count=overlap)


@router.get("/twins", response_model=List[TasteTwinOut])
def taste_twins(
    limit: int = Query(10, ge=1, le=50),
    min_overlap: int = Query(1, ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return top-N users with highest taste match to the current user."""
    my_ratings = db.query(Rating).filter(Rating.user_id == current_user.id).all()
    if not my_ratings:
        return []

    my_by_exp = {str(r.experience_id): r for r in my_ratings}
    my_exp_ids = list(my_by_exp.keys())

    # Find every user who rated at least one of the same experiences
    other_ratings = (
        db.query(Rating)
        .filter(
            Rating.experience_id.in_(my_exp_ids),
            Rating.user_id != current_user.id,
        )
        .all()
    )

    # Group by other user
    by_user = defaultdict(list)
    for r in other_ratings:
        by_user[str(r.user_id)].append(r)

    if not by_user:
        return []

    # Compute matches
    candidates = []
    for uid, ratings in by_user.items():
        pct, overlap = _compute_match(my_by_exp, ratings)
        if pct is None or overlap < min_overlap:
            continue
        candidates.append((uid, pct, overlap))

    # Sort by match desc, then overlap desc
    candidates.sort(key=lambda c: (c[1], c[2]), reverse=True)
    top = candidates[:limit]

    if not top:
        return []

    # Hydrate user info + follow state in one pass
    user_ids = [uid for uid, _, _ in top]
    users = db.query(User).filter(User.id.in_(user_ids), User.is_active == True).all()
    user_map = {str(u.id): u for u in users}

    # Get follow state in bulk
    my_following = {
        str(f.following_id)
        for f in db.query(Follow).filter(Follow.follower_id == current_user.id).all()
    }
    my_followers = {
        str(f.follower_id)
        for f in db.query(Follow).filter(Follow.following_id == current_user.id).all()
    }

    out = []
    for uid, pct, overlap in top:
        u = user_map.get(uid)
        if not u:
            continue
        is_following = uid in my_following
        is_mutual = is_following and uid in my_followers
        out.append(TasteTwinOut(
            id=uid,
            username=u.username,
            display_name=u.display_name,
            avatar_url=u.avatar_url or "",
            match_percent=pct,
            overlap_count=overlap,
            is_following=is_following,
            is_mutual=is_mutual,
            is_tastemaker=bool(u.is_tastemaker),
            tastemaker_specialty=u.tastemaker_specialty or "",
        ))
    return out
