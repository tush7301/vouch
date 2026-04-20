"""
Google Places API integration.

Uses the Google Places API (New) for:
  - Text search (find venues by query + optional location)
  - Place details (fetch full info by place_id)

All functions return normalised dicts that map to Experience model fields.
Requires GOOGLE_PLACES_API_KEY in .env.
Falls back to demo data when no API key is configured.
"""
import math
import httpx
from typing import Optional

from app.config import settings

BASE_URL = "https://places.googleapis.com/v1"

# Map Google primary types → Vouch categories
TYPE_CATEGORY_MAP = {
    "restaurant": "Food & Drink",
    "cafe": "Food & Drink",
    "bar": "Food & Drink",
    "bakery": "Food & Drink",
    "coffee_shop": "Food & Drink",
    "meal_takeaway": "Food & Drink",
    "meal_delivery": "Food & Drink",
    "night_club": "Social Scenes",
    "bowling_alley": "Social Scenes",
    "casino": "Social Scenes",
    "amusement_park": "Social Scenes",
    "gym": "Wellness & Fitness",
    "spa": "Wellness & Fitness",
    "yoga_studio": "Wellness & Fitness",
    "stadium": "Sports",
    "museum": "Arts & Culture",
    "art_gallery": "Arts & Culture",
    "movie_theater": "Live Events",
    "performing_arts_theater": "Live Events",
    "concert_hall": "Live Events",
    "tourist_attraction": "Arts & Culture",
    "park": "Wellness & Fitness",
}


def _headers() -> dict:
    return {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": (
            "places.id,places.displayName,places.formattedAddress,"
            "places.location,places.types,places.primaryType,"
            "places.photos,places.editorialSummary,places.rating,"
            "places.googleMapsUri"
        ),
    }


def _normalise_place(place: dict) -> dict:
    """Convert a Google Places (New) result into a flat dict for Experience."""
    types = place.get("types", [])
    primary_type = place.get("primaryType", types[0] if types else "")
    category = TYPE_CATEGORY_MAP.get(primary_type, "Food & Drink")

    location = place.get("location", {})
    photos = place.get("photos", [])
    photo_refs = [p.get("name", "") for p in photos[:5]]

    editorial = place.get("editorialSummary", {})

    return {
        "google_place_id": place.get("id", ""),
        "name": place.get("displayName", {}).get("text", ""),
        "category": category,
        "subcategory": primary_type.replace("_", " ").title() if primary_type else "",
        "address": place.get("formattedAddress", ""),
        "latitude": location.get("latitude"),
        "longitude": location.get("longitude"),
        "description": editorial.get("text", "") if editorial else "",
        "tags": ",".join(types[:6]),
        "cover_photo_url": _photo_url(photo_refs[0]) if photo_refs else "",
        "photo_urls": ",".join(_photo_url(r) for r in photo_refs),
    }


def _photo_url(photo_name: str, max_width: int = 800) -> str:
    """Build a photo URL from a Places photo resource name."""
    if not photo_name:
        return ""
    return (
        f"https://places.googleapis.com/v1/{photo_name}/media"
        f"?maxWidthPx={max_width}&key={settings.GOOGLE_PLACES_API_KEY}"
    )


async def search_places(
    query: str,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius: int = 50000,
    max_results: int = 10,
) -> list[dict]:
    """
    Text search for places.
    Returns a list of normalised place dicts.
    When lat/lng are provided, results are strictly restricted to that area.
    """
    if not settings.GOOGLE_PLACES_API_KEY:
        return _demo_places(query)

    body: dict = {
        "textQuery": query,
        "maxResultCount": max_results,
        "languageCode": "en",
    }

    if latitude is not None and longitude is not None:
        # locationRestriction with rectangle strictly limits results to the area.
        # (The Places API (New) only supports rectangle here, not circle.)
        # We convert the radius in metres to a lat/lng bounding box.
        lat_delta = radius / 111_000.0
        lng_delta = radius / (111_000.0 * math.cos(math.radians(latitude)))
        body["locationRestriction"] = {
            "rectangle": {
                "low": {
                    "latitude": latitude - lat_delta,
                    "longitude": longitude - lng_delta,
                },
                "high": {
                    "latitude": latitude + lat_delta,
                    "longitude": longitude + lng_delta,
                },
            }
        }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{BASE_URL}/places:searchText",
            json=body,
            headers=_headers(),
            timeout=10,
        )
        resp.raise_for_status()

    data = resp.json()
    return [_normalise_place(p) for p in data.get("places", [])]


async def get_place_details(place_id: str) -> Optional[dict]:
    """Fetch detailed info for a single place by its Google place ID."""
    if not settings.GOOGLE_PLACES_API_KEY:
        return None

    # Single-place GET endpoint uses field names without the "places." prefix
    detail_headers = {
        "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": (
            "id,displayName,formattedAddress,location,types,"
            "primaryType,photos,editorialSummary,rating,googleMapsUri"
        ),
    }

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/places/{place_id}",
            headers=detail_headers,
            timeout=10,
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()

    return _normalise_place(resp.json())


# ---------- Demo fallback (no API key) ----------

def _demo_places(query: str) -> list[dict]:
    """Return hardcoded sample venues when no API key is configured."""
    demos = [
        {
            "google_place_id": "demo_1",
            "name": "Tatiana by Kwame Onwuachi",
            "category": "Food & Drink",
            "subcategory": "Restaurant",
            "address": "10 Lincoln Center Plaza, New York, NY 10023",
            "neighborhood": "Upper West Side",
            "latitude": 40.7725,
            "longitude": -73.9835,
            "description": "Afro-Caribbean fine dining at Lincoln Center.",
            "tags": "restaurant,fine-dining,tasting-menu",
            "cover_photo_url": "",
            "photo_urls": "",
        },
        {
            "google_place_id": "demo_2",
            "name": "Dogpound",
            "category": "Wellness & Fitness",
            "subcategory": "Gym",
            "address": "155 W 23rd St, New York, NY 10011",
            "neighborhood": "Chelsea",
            "latitude": 40.7437,
            "longitude": -73.9952,
            "description": "Celebrity-favorite boutique gym with intense personal training.",
            "tags": "gym,personal-training,fitness",
            "cover_photo_url": "",
            "photo_urls": "",
        },
        {
            "google_place_id": "demo_3",
            "name": "Brooklyn Steel",
            "category": "Live Events",
            "subcategory": "Concert Hall",
            "address": "319 Frost St, Brooklyn, NY 11222",
            "neighborhood": "Williamsburg",
            "latitude": 40.7170,
            "longitude": -73.9395,
            "description": "Best mid-size live music venue in NYC.",
            "tags": "concert_hall,live_music,venue",
            "cover_photo_url": "",
            "photo_urls": "",
        },
        {
            "google_place_id": "demo_4",
            "name": "The Met",
            "category": "Arts & Culture",
            "subcategory": "Museum",
            "address": "1000 5th Ave, New York, NY 10028",
            "neighborhood": "Upper East Side",
            "latitude": 40.7794,
            "longitude": -73.9632,
            "description": "World's greatest art museum spanning 5,000 years.",
            "tags": "museum,art,culture",
            "cover_photo_url": "",
            "photo_urls": "",
        },
        {
            "google_place_id": "demo_5",
            "name": "Madison Square Garden",
            "category": "Sports",
            "subcategory": "Arena",
            "address": "4 Pennsylvania Plaza, New York, NY 10001",
            "neighborhood": "Midtown",
            "latitude": 40.7505,
            "longitude": -73.9934,
            "description": "The world's most famous arena.",
            "tags": "arena,basketball,hockey,sports",
            "cover_photo_url": "",
            "photo_urls": "",
        },
    ]

    q = query.lower()
    matches = [d for d in demos if q in d["name"].lower() or q in d["category"].lower() or q in d["tags"]]
    return matches if matches else demos[:3]
