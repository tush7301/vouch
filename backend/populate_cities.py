"""
Populate the Vouch database with experiences from the top 20 US cities.

Usage:
    cd backend && python populate_cities.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from app.config import settings
from app.services.google_places import search_places

# Top 20 US cities (by population / cultural relevance) with lat/lng centers.
CITIES = [
    ("Los Angeles",   34.0522, -118.2437),
    ("Chicago",       41.8781,  -87.6298),
    ("Houston",       29.7604,  -95.3698),
    ("Phoenix",       33.4484, -112.0740),
    ("Philadelphia",  39.9526,  -75.1652),
    ("San Antonio",   29.4241,  -98.4936),
    ("San Diego",     32.7157, -117.1611),
    ("Dallas",        32.7767,  -96.7970),
    ("San Jose",      37.3382, -121.8863),
    ("Austin",        30.2672,  -97.7431),
    ("Jacksonville",  30.3322,  -81.6557),
    ("Fort Worth",    32.7555,  -97.3308),
    ("Columbus",      39.9612,  -82.9988),
    ("Charlotte",     35.2271,  -80.8431),
    ("Indianapolis",  39.7684,  -86.1581),
    ("San Francisco", 37.7749, -122.4194),
    ("Seattle",       47.6062, -122.3321),
    ("Denver",        39.7392, -104.9903),
    ("Washington DC", 38.9072,  -77.0369),
    ("Boston",        42.3601,  -71.0589),
    ("Nashville",     36.1627,  -86.7816),
    ("Atlanta",       33.7490,  -84.3880),
    ("Miami",         25.7617,  -80.1918),
]

# Query templates per category — `{city}` is substituted per city.
# Each category has enough queries that — at MAX_RESULTS_PER_QUERY=10 and
# typical dedupe overlap — we clear 25+ unique results per city per category.
QUERY_TEMPLATES = {
    "Food & Drink": [
        "best restaurants {city}",
        "top rated restaurants {city}",
        "best cocktail bars {city}",
        "best wine bars {city}",
        "best coffee shops {city}",
        "best brunch {city}",
        "best pizza {city}",
        "best sushi {city}",
        "best tacos {city}",
        "best burgers {city}",
        "bakery {city}",
        "ice cream {city}",
    ],
    "Live Events": [
        "live music venues {city}",
        "comedy clubs {city}",
        "concert halls {city}",
        "jazz clubs {city}",
        "theaters {city}",
        "performing arts {city}",
    ],
    "Sports": [
        "sports stadiums {city}",
        "climbing gyms {city}",
        "bowling {city}",
        "golf courses {city}",
        "tennis clubs {city}",
        "ice skating {city}",
    ],
    "Wellness & Fitness": [
        "best gyms {city}",
        "yoga studios {city}",
        "pilates {city}",
        "best spas {city}",
        "massage {city}",
        "cycling studio {city}",
        "boxing gym {city}",
    ],
    "Arts & Culture": [
        "museums {city}",
        "art galleries {city}",
        "historical landmarks {city}",
        "botanical gardens {city}",
        "cultural center {city}",
        "public parks {city}",
    ],
    "Social Scenes": [
        "rooftop bars {city}",
        "nightclubs {city}",
        "speakeasy {city}",
        "beer gardens {city}",
        "dance clubs {city}",
        "lounges {city}",
    ],
}

MAX_RESULTS_PER_QUERY = 10
RADIUS_M = 20000
REQUEST_DELAY_S = 0.25


async def fetch_city(city_name: str, lat: float, lng: float) -> list[dict]:
    """Fetch all category queries for a single city."""
    all_places = []
    seen_ids = set()
    print(f"\n=== {city_name} ({lat:.4f}, {lng:.4f}) ===")

    for category, templates in QUERY_TEMPLATES.items():
        for template in templates:
            query = template.format(city=city_name)
            try:
                results = await search_places(
                    query=query,
                    latitude=lat,
                    longitude=lng,
                    radius=RADIUS_M,
                    max_results=MAX_RESULTS_PER_QUERY,
                )
            except Exception as e:
                print(f"  ERROR '{query}': {e}")
                continue

            new_count = 0
            for place in results:
                gid = place.get("google_place_id", "")
                if gid and gid not in seen_ids:
                    seen_ids.add(gid)
                    place["category"] = category
                    all_places.append(place)
                    new_count += 1
            if new_count:
                print(f"  + {new_count:>2}  {query}")
            await asyncio.sleep(REQUEST_DELAY_S)

    print(f"  → {len(all_places)} unique places in {city_name}")
    return all_places


def insert_places(places: list[dict]) -> tuple[int, int, int]:
    """Insert places into the database, skipping duplicates by google_place_id or name."""
    engine = create_engine(settings.DATABASE_URL)
    inserted = 0
    updated = 0
    skipped = 0

    with Session(engine) as session:
        for p in places:
            gid = p.get("google_place_id", "")
            name = p.get("name", "")
            if not name:
                continue

            existing = None
            if gid:
                existing = session.execute(
                    text("SELECT id, cover_photo_url FROM experiences WHERE google_place_id = :gid"),
                    {"gid": gid},
                ).fetchone()
            if not existing:
                existing = session.execute(
                    text("SELECT id, cover_photo_url FROM experiences WHERE LOWER(name) = LOWER(:name)"),
                    {"name": name},
                ).fetchone()

            if existing:
                old_photo = existing[1] or ""
                new_photo = p.get("cover_photo_url", "")
                if new_photo and (not old_photo or "unsplash" in old_photo):
                    session.execute(
                        text("""
                            UPDATE experiences
                            SET cover_photo_url = :photo,
                                photo_urls = :photos,
                                google_place_id = COALESCE(google_place_id, :gid)
                            WHERE id = :id
                        """),
                        {
                            "photo": new_photo,
                            "photos": p.get("photo_urls", ""),
                            "gid": gid,
                            "id": str(existing[0]),
                        },
                    )
                    updated += 1
                else:
                    skipped += 1
                continue

            session.execute(
                text("""
                    INSERT INTO experiences
                        (id, name, category, subcategory, address, neighborhood,
                         latitude, longitude, google_place_id,
                         cover_photo_url, photo_urls, tags, description, is_event,
                         created_at, updated_at)
                    VALUES
                        (gen_random_uuid(), :name, :category, :subcategory, :address, :neighborhood,
                         :latitude, :longitude, :gid,
                         :cover_photo_url, :photo_urls, :tags, :description, false,
                         NOW(), NOW())
                """),
                {
                    "name": name,
                    "category": p.get("category", "Food & Drink"),
                    "subcategory": p.get("subcategory", ""),
                    "address": p.get("address", ""),
                    "neighborhood": "",
                    "latitude": p.get("latitude"),
                    "longitude": p.get("longitude"),
                    "gid": gid or None,
                    "cover_photo_url": p.get("cover_photo_url", ""),
                    "photo_urls": p.get("photo_urls", ""),
                    "tags": p.get("tags", ""),
                    "description": p.get("description", ""),
                },
            )
            inserted += 1

        session.commit()

    return inserted, updated, skipped


async def main():
    grand_total = 0
    ins_total = 0
    upd_total = 0
    skp_total = 0
    for city, lat, lng in CITIES:
        places = await fetch_city(city, lat, lng)
        grand_total += len(places)
        ins, upd, skp = insert_places(places)
        ins_total += ins
        upd_total += upd
        skp_total += skp
        print(f"  inserted={ins}  updated_photos={upd}  skipped={skp}")

    print("\n============ SUMMARY ============")
    print(f"Fetched:          {grand_total}")
    print(f"Inserted new:     {ins_total}")
    print(f"Updated photos:   {upd_total}")
    print(f"Skipped (dup):    {skp_total}")


if __name__ == "__main__":
    asyncio.run(main())
