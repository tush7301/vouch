"""
Refresh cover_photo_url and photo_urls for ALL experiences that have a google_place_id.
Re-fetches photo references from Google Places API using the current API key.
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from app.config import settings
from app.services.google_places import get_place_details


async def main():
    if not settings.GOOGLE_PLACES_API_KEY:
        print("ERROR: GOOGLE_PLACES_API_KEY is not set in .env")
        sys.exit(1)

    engine = create_engine(settings.DATABASE_URL)

    with Session(engine) as session:
        rows = session.execute(
            text("SELECT id, name, google_place_id FROM experiences WHERE google_place_id IS NOT NULL AND google_place_id NOT LIKE 'demo_%'")
        ).fetchall()

    print(f"Found {len(rows)} experiences with a Google Place ID\n")

    updated = 0
    failed = 0

    for row in rows:
        exp_id, name, place_id = row
        print(f"Refreshing: {name} ({place_id})")

        try:
            place = await get_place_details(place_id)
        except Exception as e:
            print(f"  ERROR fetching details: {e}")
            failed += 1
            continue

        if not place:
            print(f"  Not found on Google Places — skipping")
            failed += 1
            continue

        cover = place.get("cover_photo_url", "")
        photos = place.get("photo_urls", "")

        if not cover:
            print(f"  No photos returned — skipping")
            failed += 1
            continue

        with Session(engine) as session:
            session.execute(
                text("""
                    UPDATE experiences
                    SET cover_photo_url = :cover,
                        photo_urls      = :photos
                    WHERE id = :id
                """),
                {"cover": cover, "photos": photos, "id": str(exp_id)},
            )
            session.commit()

        updated += 1
        print(f"  OK")
        await asyncio.sleep(0.2)   # stay within API rate limits

    print(f"\nDone. Updated: {updated}  |  Failed/skipped: {failed}")


if __name__ == "__main__":
    asyncio.run(main())
