# Vouch

> **Your social life, ranked.**

Vouch is a social discovery web app for New York City. Find restaurants,
bars, fitness classes, live events, art shows and hidden gems — ranked by
the friends and tastemakers whose taste you actually trust, not anonymous
five-star reviews.

**Live at: [vouchnyc-khka.onrender.com](https://vouchnyc-khka.onrender.com)**
· API: [vouch-api-evyg.onrender.com](https://vouch-api-evyg.onrender.com/health)
([docs](https://vouch-api-evyg.onrender.com/docs))

Built for **Columbia Startup Studio · Spring 2026** by team
**basket-architects**: Cynthia Jin, Tushar Mittal, Gaurav Agarwal, Mandy
Cheng.

---

## What it does

1. **Rate.** Visit a place, log a vouch — vibe, value, experience (each
   1–10). Optional photo + 280-char note.
2. **Discover.** Your feed shows what your friends and the tastemakers you
   follow vouched for this week. Map view shows their pins by neighborhood.
3. **Save.** Add to your wishlist or build a Curated List ("Best date-night
   rooftops") to share.

The whole product is the *trust filter*. We don't show you anonymous
reviews — only ratings from people in your graph or curators you chose.

## Status

- **~8,000 places** seeded across ~25 US cities (NYC metro + top social
  cities). 99% have Google photos, 100% have map coordinates.
- **6 curated tastemaker profiles** to bootstrap the social graph
  (food, nightlife, arts, fitness, live music, hidden gems).
- **End-to-end working:** auth, onboarding, feed, map, search, ratings,
  wishlist, lists, friends, profile, taste-match.
- **Analytics live:** GA4 + Amplitude dual-stack.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19 · Vite 7 · Tailwind CSS 4 · React Leaflet |
| Map tiles | Esri World Light Gray Canvas (keyless) |
| Backend | FastAPI · SQLAlchemy 2 · Alembic · psycopg2 |
| Database | PostgreSQL (Render managed) |
| Auth | JWT + Google OAuth (GIS ID-token) |
| External APIs | Google Places (New) · Ticketmaster Discovery |
| Hosting | Render Blueprint (`render.yaml`) |
| Analytics | GA4 + Amplitude |

See [`CLAUDE.md`](./CLAUDE.md) for architecture details, conventions, and
gotchas.

## Run locally

Requirements: Python 3.11+, Node 18+, PostgreSQL (e.g.
`brew install postgresql@16 && brew services start postgresql@16`).

### Backend

```bash
python3 -m venv .venv && source .venv/bin/activate   # repo root
pip install -r backend/requirements.txt

cd backend
cp .env.example .env   # then fill in the values below
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

`backend/.env`:

```
DATABASE_URL=postgresql://vouch:vouch@localhost:5432/vouch
SECRET_KEY=dev-secret-change-me
GOOGLE_PLACES_API_KEY=<Places API (New) key, starts with AIza>
TICKETMASTER_API_KEY=<Ticketmaster Discovery consumer key>
GOOGLE_CLIENT_ID=<OAuth client id, ends in .apps.googleusercontent.com>
```

API will be live at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install

cat > .env.local <<EOF
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=<same client id as backend>
EOF

npm run dev
```

Frontend will be live at `http://localhost:5173`. If you run the API on
another port, point `VITE_API_URL` at it (any `http(s)://` URL is honored)
and add the frontend origin via `FRONTEND_URL` for CORS.

### Seeding places (optional)

To populate your local DB with real Google Places data:

```bash
cd backend && source ../.venv/bin/activate
python populate_cities.py     # ~$55, all default cities
# or trim the CITIES list at the top to seed just your area
```

### Copying data to/from Render

```bash
# local → Render (replaces Render's tables)
pg_dump -d vouch --clean --if-exists --no-owner --no-acl -Fc -f vouch.dump
pg_restore --clean --if-exists --no-owner --no-acl -d "$RENDER_EXTERNAL_DB_URL" vouch.dump
```

Get the External Database URL from Render → `vouch-db` → Info →
Connections. Keep it in `backend/.env.render` (git-ignored), never in a
committed file.

### Refreshing place photos

Google Places photo names **expire**. When images start returning 400 /
broken (or after rotating `GOOGLE_PLACES_API_KEY` — photo URLs embed it):

```bash
cd backend && python refresh_photos_only.py   # requests only `photos` → free SKU
```

Run it against the local DB, then sync the two photo columns to Render (or
point `DATABASE_URL` at Render for the run).

## Deploy

This repo is wired to Render via `render.yaml` (Blueprint "vouch", branch
`main`). Pushing to `main` auto-deploys both services:

| Service | Type | URL |
|---|---|---|
| `vouchnyc` | Static site | https://vouchnyc-khka.onrender.com |
| `vouch-api` | Docker web service | https://vouch-api-evyg.onrender.com |
| `vouch-db` | Postgres (free) | internal — **free tier expires 30 days after creation (created 2026-10-25 → ~2026-11-24)**, then a 14-day grace period before deletion |

Env vars set in the Render dashboard (not in `render.yaml`):
- `vouch-api`: `GOOGLE_PLACES_API_KEY`, `TICKETMASTER_API_KEY`,
  `GOOGLE_CLIENT_ID`
- `vouchnyc`: `VITE_GOOGLE_CLIENT_ID`

`render.yaml` hardcodes `VITE_API_URL` to the API's public URL. If the
Blueprint is ever recreated, Render assigns a new `vouch-api-xxxx` hostname —
update `VITE_API_URL` in `render.yaml` and the fallback in
`frontend/src/lib/constants.js`, then push. Vite bakes `VITE_*` vars at build
time, so changing them in the dashboard needs a frontend redeploy.

### Google Cloud (project "Vouch", `snappy-cistern-490013-i4`)

- **API key "Vouch Places"** — restricted to Places API (New), no
  application restriction (photo URLs are loaded directly by browsers).
- **OAuth client "Vouch"** — its *Authorized JavaScript origins* must include
  `https://vouchnyc-khka.onrender.com` and `http://localhost:5173`, or Google
  sign-in fails with `origin_mismatch`.

## Running costs

At current usage the system costs **~$0/month**; the only thing that scales
with traffic is Google Places photos.

| Service | Plan | Cost |
|---|---|---|
| Render `vouchnyc` + `vouch-api` | Free (750 instance-hrs/mo, API sleeps after 15 min idle) | $0 |
| Render `vouch-db` | Free, 1 GB (DB is ~94 MB) — expires ~2026-11-24 | $0 → **$6/mo** (Basic-256mb) to keep it |
| Render bandwidth | Hobby: 5 GB/mo included, then $0.15/GB (~160 KB per first visit) | $0 |
| Google Places — photo loads | Place Details Photos: 1,000 free/mo, then $7 / 1K | **main variable cost** |
| Google Places — place search | Text Search Enterprise + Atmosphere (field mask has `editorialSummary`) | ~$40 / 1K after free tier |
| Google Places — map area search | Text Search Pro: 5,000 free/mo, then $32 / 1K | ~$0 |
| Google Places — photo refresh | `photos`-only Place Details = Essentials IDs Only | $0 |
| Ticketmaster Discovery | Free (5,000 calls/day) | $0 |
| GA4 / Amplitude / Esri tiles | Free tiers | $0 |

Rough monthly totals: **demo / class use** (few hundred visits) ≈ **$0**;
**always-on** (paid API + DB) ≈ **$13 + Places**; Places photos at ~20 per
page view ≈ **$0.14 per page view beyond the first ~50 views/month**.
Set a daily quota on the "Vouch Places" key to cap spend. Prices checked
2026-10-25 — see Google Maps Platform and Render pricing pages.

## Repo layout

```
backend/         FastAPI app + Alembic migrations + populate/refresh scripts
frontend/        React 19 SPA
render.yaml      Deploy blueprint (API + static + DB)
CLAUDE.md        AI / engineering context — read before changing code
README.md        This file
```

## Course context

This is the **product repo** for Columbia Startup Studio team
basket-architects. Course deliverables (interviews, brand position,
synthetic testing, growth strategy, user testing) live in the parallel
[course repo](https://github.com/kenxle/columbia-startup-studio) under
`teams/basket-architects/`.

## License

See [LICENSE](./LICENSE).
