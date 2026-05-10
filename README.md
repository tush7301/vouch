# Vouch

> **Your social life, ranked.**

Vouch is a social discovery web app for New York City. Find restaurants,
bars, fitness classes, live events, art shows and hidden gems — ranked by
the friends and tastemakers whose taste you actually trust, not anonymous
five-star reviews.

**Live at: [vouchnyc.onrender.com](https://vouchnyc.onrender.com)**

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

- **~6,800 places** seeded across 16 US cities (NYC metro + 15 top social
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
| Backend | FastAPI · SQLAlchemy 2 · Alembic · psycopg2 |
| Database | PostgreSQL (Render managed) |
| Auth | JWT + Google OAuth (GIS ID-token) |
| External APIs | Google Places (New) · Ticketmaster Discovery |
| Hosting | Render Blueprint (`render.yaml`) |
| Analytics | GA4 + Amplitude |

See [`CLAUDE.md`](./CLAUDE.md) for architecture details, conventions, and
gotchas.

## Run locally

Requirements: Python 3.11+, Node 18+, a Postgres database (Render free tier
works).

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Configure
cat > .env <<EOF
DATABASE_URL=postgresql://user:pass@localhost:5432/vouch
SECRET_KEY=dev-secret-change-me
GOOGLE_PLACES_API_KEY=<your key>
GOOGLE_CLIENT_ID=<your oauth client id>
EOF

# Migrate + run
alembic upgrade head
uvicorn app.main:app --reload --port 8000
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

Frontend will be live at `http://localhost:5173`.

### Seeding places (optional)

To populate your local DB with real Google Places data:

```bash
cd backend && source .venv/bin/activate
python populate_cities.py     # ~$55, all 23 default cities
# or trim the CITIES list at the top to seed just your area
```

## Deploy

This repo is wired to Render via `render.yaml`. Pushing to `main`
auto-deploys both services. The static frontend needs a manual rebuild
when frontend env vars change (Vite bakes them at build time).

Required Render dashboard env vars (not in `render.yaml`):
- `vouch-api`: `GOOGLE_PLACES_API_KEY`, `TICKETMASTER_API_KEY`,
  `GOOGLE_CLIENT_ID`, `ADMIN_SECRET`
- `vouchnyc`: `VITE_GOOGLE_CLIENT_ID`

## Repo layout

```
backend/         FastAPI app + Alembic migrations + populate scripts
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
