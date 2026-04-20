"""
Wishlist router — save / unsave experiences, list saved items.
"""
import math
from typing import List, Optional
from uuid import UUID as PyUUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.experience import Experience
from app.models.wishlist import Wishlist
from app.models.user import User
from app.schemas.schemas import ExperienceOut, WishlistOut

router = APIRouter(prefix="/wishlist", tags=["wishlist"])


@router.get("/", response_model=List[WishlistOut])
def get_wishlist(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all wishlisted experience IDs for the current user."""
    items = (
        db.query(Wishlist)
        .filter(Wishlist.user_id == current_user.id)
        .order_by(Wishlist.created_at.desc())
        .all()
    )
    return items


@router.get("/experiences", response_model=List[ExperienceOut])
def get_wishlist_experiences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get full experience objects for all wishlisted items across all cities."""
    exp_ids = (
        db.query(Wishlist.experience_id)
        .filter(Wishlist.user_id == current_user.id)
        .scalar_subquery()
    )
    return (
        db.query(Experience)
        .filter(Experience.id.in_(exp_ids))
        .order_by(Experience.name)
        .all()
    )


@router.post("/{experience_id}", response_model=WishlistOut, status_code=201)
def add_to_wishlist(
    experience_id: PyUUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add an experience to the user's wishlist."""
    # Verify experience exists
    exp = db.query(Experience).filter(Experience.id == experience_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experience not found")

    # Check duplicate
    existing = (
        db.query(Wishlist)
        .filter(Wishlist.user_id == current_user.id, Wishlist.experience_id == experience_id)
        .first()
    )
    if existing:
        return existing

    item = Wishlist(user_id=current_user.id, experience_id=experience_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{experience_id}", status_code=204)
def remove_from_wishlist(
    experience_id: PyUUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove an experience from the user's wishlist."""
    item = (
        db.query(Wishlist)
        .filter(Wishlist.user_id == current_user.id, Wishlist.experience_id == experience_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Not in wishlist")
    db.delete(item)
    db.commit()
    return None


@router.get("/check/{experience_id}")
def check_wishlist(
    experience_id: PyUUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if an experience is in the user's wishlist."""
    exists = (
        db.query(Wishlist)
        .filter(Wishlist.user_id == current_user.id, Wishlist.experience_id == experience_id)
        .first()
    )
    return {"wishlisted": exists is not None}
