"""
Re-fetch Google Places photo names for every experience, requesting ONLY the
`photos` field (Place Details "Essentials IDs Only" SKU — no charge).

Google photo resource names expire; stale ones return 400 "The photo resource
in the request is invalid". Run this whenever photos start breaking, or after
rotating GOOGLE_PLACES_API_KEY (photo URLs embed the key).

Resumable: skips rows whose cover_photo_url already carries the current key.
Places with no photos / no longer on Google get their photo columns cleared.

Usage:
    cd backend && python refresh_photos_only.py [--limit N] [--concurrency N]
"""
import argparse
import asyncio
import collections
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import httpx  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

from app.config import settings  # noqa: E402
from app.services.google_places import BASE_URL, _photo_url  # noqa: E402

KEY = settings.GOOGLE_PLACES_API_KEY
engine = create_engine(settings.DATABASE_URL)
stats = collections.Counter()


async def fetch(client, sem, exp_id, place_id):
    async with sem:
        for attempt in range(4):
            r = await client.get(
                f"{BASE_URL}/places/{place_id}",
                headers={"X-Goog-Api-Key": KEY, "X-Goog-FieldMask": "photos"},
                timeout=15,
            )
            if r.status_code == 429 or r.status_code >= 500:
                await asyncio.sleep(2 ** attempt)
                continue
            break
    if r.status_code in (400, 404):
        stats["not_found"] += 1
        return exp_id, "", ""
    if r.status_code != 200:
        stats[f"http_{r.status_code}"] += 1
        return None
    refs = [p["name"] for p in r.json().get("photos", [])]
    if not refs:
        stats["no_photos"] += 1
        return exp_id, "", ""
    stats["updated"] += 1
    return exp_id, _photo_url(refs[0]), ",".join(_photo_url(x) for x in refs)


async def main(limit: int, concurrency: int):
    if not KEY:
        sys.exit("ERROR: GOOGLE_PLACES_API_KEY is not set in .env")

    with engine.connect() as c:
        rows = c.execute(text(
            "SELECT id, google_place_id FROM experiences "
            "WHERE google_place_id IS NOT NULL AND google_place_id <> '' "
            "AND google_place_id NOT LIKE 'demo_%' "
            "AND coalesce(cover_photo_url,'') NOT LIKE :k ORDER BY id"
        ), {"k": f"%key={KEY}%"}).fetchall()
    if limit:
        rows = rows[:limit]
    print(f"to refresh: {len(rows)}", flush=True)

    sem = asyncio.Semaphore(concurrency)
    async with httpx.AsyncClient() as client:
        for i in range(0, len(rows), 200):
            chunk = rows[i:i + 200]
            results = await asyncio.gather(*(fetch(client, sem, r[0], r[1]) for r in chunk))
            with engine.begin() as c:
                for res in filter(None, results):
                    c.execute(text(
                        "UPDATE experiences SET cover_photo_url = :c, photo_urls = :p WHERE id = :id"
                    ), {"c": res[1], "p": res[2], "id": res[0]})
            print(f"{i + len(chunk)}/{len(rows)} {dict(stats)}", flush=True)
            if stats.get("http_403"):
                sys.exit("403 from Places API — check the key / Places API (New) / billing")

    if stats.get("http_429"):
        print("Some rows were rate-limited — rerun with --concurrency 2 to retry them.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--concurrency", type=int, default=8)
    args = ap.parse_args()
    asyncio.run(main(args.limit, args.concurrency))
