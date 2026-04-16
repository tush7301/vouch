"""
Ratings router — submit, edit, list, and query ratings with real auth.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.schemas.schemas import RatingOut, RatingCreate, RatingUpdate, EnrichedRatingOut
from app.models.rating import Rating
from app.models.experience import Experience
from app.models.user import User

router = APIRouter(prefix="/ratings", tags=["ratings"])


@router.post("/", response_model=RatingOut, status_code=201)
def create_rating(
    payload: RatingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a new rating for an experience (auth required)."""
    # Verify experience exists
    exp = db.query(Experience).filter(Experience.id == payload.experience_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experience not found")

    # Check if user already rated this experience
    existing = (
        db.query(Rating)
        .filter(Rating.user_id == current_user.id, Rating.experience_id == payload.experience_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="You already rated this experience")

    # Compute overall score (average of 3 axes)
    overall = round((payload.vibe_score + payload.value_score + payload.experience_score) / 3, 1)

    rating = Rating(
        user_id=current_user.id,
        experience_id=payload.experience_id,
        vibe_score=payload.vibe_score,
        value_score=payload.value_score,
        experience_score=payload.experience_score,
        overall_score=overall,
        review_text=payload.review_text or "",
        tags=payload.tags or "",
    )
    db.add(rating)
    db.commit()
    db.refresh(rating)
    return rating


@router.patch("/{rating_id}", response_model=RatingOut)
def update_rating(
    rating_id: str,
    payload: RatingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an existing rating (only the author can edit)."""
    rating = db.query(Rating).filter(Rating.id == rating_id).first()
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")
    if str(rating.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your rating")

    if payload.vibe_score is not None:
        rating.vibe_score = payload.vibe_score
    if payload.value_score is not None:
        rating.value_score = payload.value_score
    if payload.experience_score is not None:
        rating.experience_score = payload.experience_score
    if payload.review_text is not None:
        rating.review_text = payload.review_text
    if payload.tags is not None:
        rating.tags = payload.tags

    # Recompute overall
    rating.overall_score = round(
        (rating.vibe_score + rating.value_score + rating.experience_score) / 3, 1
    )

    db.commit()
    db.refresh(rating)
    return rating


@router.get("/mine/{experience_id}", response_model=Optional[RatingOut])
def get_my_rating(
    experience_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's rating for a specific experience, or null."""
    rating = (
        db.query(Rating)
        .filter(Rating.user_id == current_user.id, Rating.experience_id == experience_id)
        .first()
    )
    return rating


@router.get("/experience/{experience_id}", response_model=List[EnrichedRatingOut])
def get_ratings_for_experience(experience_id: str, db: Session = Depends(get_db)):
    """Get all ratings for a given experience, enriched with user info."""
    rows = (
        db.query(Rating, User)
        .join(User, Rating.user_id == User.id)
        .filter(Rating.experience_id == experience_id)
        .order_by(Rating.created_at.desc())
        .all()
    )
    return [
        EnrichedRatingOut(
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
            user_display_name=u.display_name,
            user_avatar_url=u.avatar_url or "",
            user_username=u.username,
            user_is_tastemaker=bool(u.is_tastemaker),
            user_tastemaker_specialty=u.tastemaker_specialty or "",
        )
        for r, u in rows
    ]


@router.get("/user/{user_id}", response_model=List[RatingOut])
def get_ratings_by_user(user_id: str, db: Session = Depends(get_db)):
    """Get all ratings by a specific user."""
    return (
        db.query(Rating)
        .filter(Rating.user_id == user_id)
        .order_by(Rating.created_at.desc())
        .all()
    )
