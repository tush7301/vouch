"""
Map router — geo-pins for experiences and neighbourhood aggregations.
"""
import math
from typing import Optional, List as TList

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from app.auth import get_current_user_optional, get_current_user
from app.config import settings
from app.database import get_db
from app.models.experience import Experience
from app.models.follow import Follow
from app.models.rating import Rating
from app.models.user import User
from app.models.wishlist import Wishlist
from app.schemas.schemas import LocateResult, MapPinOut, NeighborhoodOut

router = APIRouter(prefix="/map", tags=["map"])


# ── Helpers ───────────────────────────────────────────────────────

# 1° latitude ≈ 111 km; 1° longitude varies with latitude (cos lat * 111).
_DEG_LAT_KM = 111.0


def _km_to_deg_lat(km: float) -> float:
    return km / _DEG_LAT_KM


def _km_to_deg_lng(km: float, at_latitude: float) -> float:
    # Avoid division by zero near the poles (not relevant for NYC, but safe).
    cos_lat = max(math.cos(math.radians(at_latitude)), 0.01)
    return km / (_DEG_LAT_KM * cos_lat)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between two points."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# NYC bias for fallback geocoding — we're an NYC-first product, and
# "Soho" should resolve to Manhattan, not London.
_NYC_CENTER = (40.7580, -73.9855)
_NYC_BBOX = {
    "low":  {"latitude": 40.4774, "longitude": -74.2591},
    "high": {"latitude": 40.9176, "longitude": -73.7004},
}


# ── Pins ──────────────────────────────────────────────────────────

@router.get("/pins", response_model=TList[MapPinOut])
def get_map_pins(
    category: Optional[str] = None,
    layer: Optional[str] = Query(None, description="mine | friends | wishlist | all"),
    lat: Optional[float] = Query(None, description="User latitude for proximity filter"),
    lng: Optional[float] = Query(None, description="User longitude for proximity filter"),
    radius_km: float = Query(50.0, description="Radius in km when lat/lng provided"),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Return experiences that have lat/lng, with their average score.
    Filterable by category, layer, and proximity (lat/lng/radius_km).
    """
    # Base: experiences with coordinates
    base = (
        db.query(
            Experience,
            func.coalesce(func.avg(Rating.overall_score), 0).label("avg_score"),
            func.count(Rating.id).label("num_ratings"),
        )
        .outerjoin(Rating, Rating.experience_id == Experience.id)
        .filter(Experience.latitude.isnot(None), Experience.longitude.isnot(None))
        .group_by(Experience.id)
    )

    if category:
        base = base.filter(Experience.category == category)

    # Proximity filter — bounding box approximation (1° lat ≈ 111 km)
    if lat is not None and lng is not None:
        lat_delta = radius_km / 111.0
        lng_delta = radius_km / (111.0 * math.cos(math.radians(lat)))
        base = base.filter(
            Experience.latitude.between(lat - lat_delta, lat + lat_delta),
            Experience.longitude.between(lng - lng_delta, lng + lng_delta),
        )

    # Layer filtering (requires auth)
    if current_user and layer == "mine":
        my_exp_ids = (
            db.query(Rating.experience_id)
            .filter(Rating.user_id == current_user.id)
            .scalar_subquery()
        )
        base = base.filter(Experience.id.in_(my_exp_ids))

    elif current_user and layer == "friends":
        friend_ids = (
            db.query(Follow.following_id)
            .filter(Follow.follower_id == current_user.id)
            .scalar_subquery()
        )
        friend_exp_ids = (
            db.query(Rating.experience_id)
            .filter(Rating.user_id.in_(friend_ids))
            .scalar_subquery()
        )
        base = base.filter(Experience.id.in_(friend_exp_ids))

    elif current_user and layer == "wishlist":
        wish_exp_ids = (
            db.query(Wishlist.experience_id)
            .filter(Wishlist.user_id == current_user.id)
            .scalar_subquery()
        )
        base = base.filter(Experience.id.in_(wish_exp_ids))

    rows = base.order_by(desc("avg_score")).limit(200).all()

    pins = []
    for exp, avg_score, num_ratings in rows:
        pins.append(MapPinOut(
            id=exp.id,
            name=exp.name,
            category=exp.category,
            latitude=exp.latitude,
            longitude=exp.longitude,
            address=exp.address or "",
            neighborhood=exp.neighborhood or "",
            cover_photo_url=exp.cover_photo_url or "",
            avg_score=round(float(avg_score), 1),
            num_ratings=int(num_ratings),
        ))
    return pins


# ── Locate ────────────────────────────────────────────────────────

@router.get("/locate", response_model=LocateResult)
async def locate_area(
    query: str = Query(..., min_length=2, description="Neighbourhood/area to search for"),
    db: Session = Depends(get_db),
):
    """
    Resolve a free-text area query (e.g. "Soho", "Williamsburg", "Lower East Side")
    to lat/lng + suggested radius, biased to NYC.

    Strategy:
      1. DB-first: if any of our experiences have a `neighborhood` matching the
         query, return the centroid of their lat/lng (free, instant, accurate
         for areas we already know).
      2. Fallback: Google Geocoding API biased to NYC.
      3. If neither yields anything, 404.
    """
    q = query.strip()
    if not q:
        raise HTTPException(status_code=400, detail="Query required")

    # ── Step 1: DB-first
    rows = (
        db.query(Experience.latitude, Experience.longitude, Experience.neighborhood)
        .filter(
            Experience.latitude.isnot(None),
            Experience.longitude.isnot(None),
            Experience.neighborhood.ilike(f"%{q}%"),
        )
        .all()
    )

    if rows:
        lats = [r.latitude for r in rows]
        lngs = [r.longitude for r in rows]
        center_lat = sum(lats) / len(lats)
        center_lng = sum(lngs) / len(lngs)
        max_dist = max(
            _haversine_km(center_lat, center_lng, lat, lng)
            for lat, lng in zip(lats, lngs)
        )
        radius_km = max(0.6, min(max_dist + 0.3, 5.0))
        labels = [r.neighborhood for r in rows if r.neighborhood]
        label = max(set(labels), key=labels.count) if labels else q.title()
        return LocateResult(
            label=label,
            latitude=center_lat,
            longitude=center_lng,
            radius_km=round(radius_km, 2),
            source="db",
            experience_count=len(rows),
        )

    # ── Step 2: Google Geocoding fallback (biased to NYC)
    if not settings.GOOGLE_PLACES_API_KEY:
        raise HTTPException(
            status_code=404,
            detail=f'No area matching "{q}" — and Google geocoding is not configured.',
        )

    body = {
        "textQuery": f"{q}, New York" if "new york" not in q.lower() else q,
        "maxResultCount": 1,
        "languageCode": "en",
        "locationBias": {"rectangle": _NYC_BBOX},
    }
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "places.formattedAddress,places.location,places.displayName,places.viewport",
    }

    async with httpx.AsyncClient(timeout=8) as client:
        resp = await client.post(
            "https://places.googleapis.com/v1/places:searchText",
            json=body,
            headers=headers,
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Geocoding failed ({resp.status_code})")

    places = resp.json().get("places", [])
    if not places:
        raise HTTPException(status_code=404, detail=f'No area matching "{q}".')

    p = places[0]
    loc = p.get("location") or {}
    lat = loc.get("latitude")
    lng = loc.get("longitude")
    if lat is None or lng is None:
        raise HTTPException(status_code=502, detail="Geocoder returned no coordinates")

    vp = p.get("viewport") or {}
    low = vp.get("low") or {}
    high = vp.get("high") or {}
    if low and high:
        diag = _haversine_km(low["latitude"], low["longitude"], high["latitude"], high["longitude"])
        radius_km = max(0.6, min(diag / 2, 5.0))
    else:
        radius_km = 1.5

    label = (
        p.get("displayName", {}).get("text")
        or p.get("formattedAddress")
        or q.title()
    )

    d_lat = _km_to_deg_lat(radius_km)
    d_lng = _km_to_deg_lng(radius_km, lat)
    nearby_count = (
        db.query(func.count(Experience.id))
        .filter(
            Experience.latitude.isnot(None),
            Experience.longitude.isnot(None),
            Experience.latitude.between(lat - d_lat, lat + d_lat),
            Experience.longitude.between(lng - d_lng, lng + d_lng),
        )
        .scalar()
        or 0
    )

    return LocateResult(
        label=label,
        latitude=lat,
        longitude=lng,
        radius_km=round(radius_km, 2),
        source="geocode",
        experience_count=int(nearby_count),
    )


# ── Neighborhoods ─────────────────────────────────────────────────

@router.get("/neighborhoods", response_model=TList[NeighborhoodOut])
def get_neighborhoods(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Aggregated stats per neighbourhood — how many experiences, avg score.
    """
    q = (
        db.query(
            Experience.neighborhood,
            func.count(Experience.id).label("count"),
            func.coalesce(func.avg(Rating.overall_score), 0).label("avg_score"),
        )
        .outerjoin(Rating, Rating.experience_id == Experience.id)
        .filter(Experience.neighborhood != "", Experience.neighborhood.isnot(None))
        .group_by(Experience.neighborhood)
    )
    if category:
        q = q.filter(Experience.category == category)

    rows = q.having(func.count(Experience.id) >= 1).order_by(desc("count")).limit(50).all()

    return [
        NeighborhoodOut(
            name=name,
            experience_count=count,
            avg_score=round(float(avg_score), 1),
        )
        for name, count, avg_score in rows
    ]
