"""
Experiences router — CRUD + external API lookups (Google Places, Ticketmaster).
"""
from typing import Optional, List as TList
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.schemas.schemas import ExperienceOut, ExperienceCreate
from app.models.experience import Experience
from app.models.user import User
from app.services import google_places, ticketmaster

router = APIRouter(prefix="/experiences", tags=["experiences"])


# ---------- Local DB queries ----------

@router.get("/", response_model=TList[ExperienceOut])
def list_experiences(
    category: Optional[str] = None,
    neighborhood: Optional[str] = None,
    q: Optional[str] = None,
    is_event: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Search / list experiences stored in our DB with optional filters."""
    query = db.query(Experience)
    if category:
        query = query.filter(Experience.category == category)
    if neighborhood:
        query = query.filter(Experience.neighborhood == neighborhood)
    if is_event is not None:
        query = query.filter(Experience.is_event == is_event)
    if q:
        query = query.filter(Experience.name.ilike(f"%{q}%"))
    return query.order_by(Experience.name).offset(skip).limit(limit).all()


@router.get("/search", response_model=TList[ExperienceOut])
def search_experiences(
    q: str = Query(..., min_length=1),
    category: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Full-text search across experiences in our DB."""
    query = db.query(Experience).filter(Experience.name.ilike(f"%{q}%"))
    if category:
        query = query.filter(Experience.category == category)
    return query.order_by(Experience.name).offset(skip).limit(limit).all()


@router.get("/{experience_id}", response_model=ExperienceOut)
def get_experience(experience_id: str, db: Session = Depends(get_db)):
    """Get a single experience by ID."""
    exp = db.query(Experience).filter(Experience.id == experience_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experience not found")
    return exp


@router.post("/", response_model=ExperienceOut, status_code=201)
def create_experience(
    payload: ExperienceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new experience entry (auth required)."""
    # De-duplicate by google_place_id or ticketmaster_id if provided
    if payload.google_place_id:
        existing = (
            db.query(Experience)
            .filter(Experience.google_place_id == payload.google_place_id)
            .first()
        )
        if existing:
            return existing
    if payload.ticketmaster_id:
        existing = (
            db.query(Experience)
            .filter(Experience.ticketmaster_id == payload.ticketmaster_id)
            .first()
        )
        if existing:
            return existing

    exp = Experience(**payload.model_dump())
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp


# ---------- External API lookups ----------

@router.get("/external/places")
async def search_external_places(
    q: str = Query(..., min_length=1),
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: int = Query(50000, description="Search radius in metres (default 50 km)"),
):
    """
    Search Google Places API for venues.
    Returns normalised results (not yet saved to our DB).
    Frontend can call POST /experiences/ to import a selected result.
    """
    results = await google_places.search_places(q, latitude=lat, longitude=lng, radius=radius)
    return {"results": results, "source": "google_places"}


@router.get("/external/events")
async def search_external_events(
    q: str = Query(..., min_length=1),
    city: Optional[str] = None,
):
    """
    Search Ticketmaster API for events.
    Returns normalised results (not yet saved to our DB).
    """
    results = await ticketmaster.search_events(q, city=city)
    return {"results": results, "source": "ticketmaster"}


@router.post("/import/place", response_model=ExperienceOut, status_code=201)
def import_place(
    google_place_id: str = Query(...),
    name: str = Query(...),
    category: str = Query("Food & Drink"),
    address: str = Query(""),
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    description: str = Query(""),
    cover_photo_url: str = Query(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Import a Google Place into our DB as an Experience.
    If the place_id already exists, return the existing record.
    """
    existing = (
        db.query(Experience)
        .filter(Experience.google_place_id == google_place_id)
        .first()
    )
    if existing:
        return existing

    exp = Experience(
        name=name,
        category=category,
        address=address,
        latitude=latitude,
        longitude=longitude,
        description=description,
        cover_photo_url=cover_photo_url,
        google_place_id=google_place_id,
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp
