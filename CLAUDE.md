# CLAUDE.md — Vouch

Project context for Claude (and any AI agent) working in this codebase.
Read this before making changes — most landmines are documented here.

## What this project is

**Vouch** is a social discovery web app for NYC. Users rate places (food,
nightlife, fitness, arts, events, sports) on three dimensions — vibe, value,
experience — and see ratings ranked by friends + tastemakers they trust.

- **Live:** https://vouchnyc.onrender.com
- **API:** https://vouch-api-5pa4.onrender.com
- **Tagline:** *Your social life, ranked.*

Built for Columbia Startup Studio (Spring 2026), team **basket-architects**
(Cynthia Jin · Tushar Mittal · Gaurav Agarwal · Mandy Cheng).

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite 7 + Tailwind CSS 4 + React Router 6 + React Leaflet |
| Backend | FastAPI + SQLAlchemy 2 + Alembic + psycopg2 |
| DB | PostgreSQL (Render managed) |
| Auth | Email/password (JWT) + Google OAuth (GIS ID-token flow) |
| External | Google Places API (New), Ticketmaster Discovery |
| Hosting | Render Blueprint (`render.yaml` at repo root) |
| Analytics | GA4 (`G-TGJBM7MPX4`) + Amplitude — dual stack |

## Repo layout

```
backend/
  app/
    routers/        # auth, users, experiences, ratings, feed, wishlist,
                    # lists, friends, taste_match, map
    models/         # SQLAlchemy ORM
    services/       # google_places, ticketmaster, taste_match scoring
    main.py         # FastAPI app + CORS
    config.py       # env-var loader (DATABASE_URL, *_API_KEY, etc.)
  alembic/          # migrations — see "migrations" gotcha below
  populate_cities.py        # seeds places from Google Places
  Dockerfile
  requirements.txt

frontend/
  src/
    pages/          # Landing, Login, Onboarding, Feed, Map, Search,
                    # ExperienceDetail, RateExperience, Profile,
                    # FindFriends, Settings
    components/     # ui/ (Button, VouchLogo, ...) + feature components
    context/        # AuthContext, LocationContext
    lib/            # api.js (REST client), analytics.js, constants.js
  vite.config.js
  package.json

render.yaml         # blueprint: vouch-api (Docker) + vouchnyc (static)
                    # + vouch-db (Postgres free)
```

## How to run locally

```bash
# Backend
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # then fill in DATABASE_URL + API keys
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm install
echo "VITE_API_URL=http://localhost:8000" > .env.local
echo "VITE_GOOGLE_CLIENT_ID=<your client id>" >> .env.local
npm run dev
```

## Conventions

- **Branching:** feature branches + PRs. Never push directly to `main`.
- **Commits:** imperative subject ("Add X", "Fix Y"), wrap body at 80.
- **Frontend:** functional components only. Tailwind utility classes — avoid
  ad-hoc CSS files. Routes live in `frontend/src/App.jsx`.
- **API client:** all backend calls go through `frontend/src/lib/api.js`.
  Never `fetch()` inline in a component. The `request()` wrapper handles
  auth headers, JSON, and error parsing.
- **Backend routes:** literal paths (e.g. `/tastemakers`) MUST be declared
  before path-parameter routes (`/{user_id}`). FastAPI matches in order.
- **Models <-> migrations:** any model change needs an Alembic migration.
  Don't rely on `Base.metadata.create_all` in prod.
- **Secrets:** never commit `.env`. Render envvars are the source of truth.
  Frontend `VITE_*` vars are baked at build time — changing them requires a
  manual redeploy.

## Deployment

`render.yaml` is the single source of truth. Pushing to `main` triggers:
- `vouch-api` (Docker, free tier — cold starts ~30 s after idle)
- `vouchnyc` (static React build) — **frontend env-var changes need a
  manual redeploy**, they don't auto-rebuild on env edits

Database stays warm. The `vouch-api` service has 4 critical env vars set in
the Render dashboard (not in `render.yaml`):
`GOOGLE_PLACES_API_KEY`, `TICKETMASTER_API_KEY`, `GOOGLE_CLIENT_ID`,
`ADMIN_SECRET`.

## Gotchas — read before debugging

1. **CORS allow-origin regex** is hand-written in `backend/app/main.py` to
   accept `*.onrender.com`. Don't replace with `allow_origins=["*"]` —
   Google's CSP header rejects it on the auth flow.

2. **Google OAuth** uses GIS (ID-token) flow, *not* server-side redirect.
   `VITE_GOOGLE_CLIENT_ID` is the public client; backend `GOOGLE_CLIENT_ID`
   must match for token verification. The same client ID is used for both
   frontend and backend.

3. **Render free-tier cold starts** can take 30–60 s on the first request
   after idle. Don't mistake this for a deploy failure.

4. **Migration idempotency.** Some prod tables (`lists`, `list_items`) were
   created out-of-band before their migration shipped. New table-creating
   migrations should check `inspect(bind).get_table_names()` first — see
   `2026_04_19_add_lists_tables.py` for the pattern.

5. **`experiences.cover_photo_url` is TEXT, not VARCHAR(500).** Google
   Places photo URLs include opaque tokens that exceed 500 chars. The
   widening migration is `2026_04_19_widen_photo_url.py`.

6. **`api.js` had a duplicate `lists:` key** during the upstream merge —
   JS silently keeps the last one, dropping `addItem`/`removeItem`.
   If you see lists endpoints "missing" in the bundle, check for re-merge.

7. **`populate_cities.py`** mutates the DB directly (raw SQL via
   SQLAlchemy `text()`). Idempotent: dedupes on `google_place_id` then on
   case-insensitive name. Run cost ≈ $5/city against Google Places.

8. **Frontend `lib/constants.js` API URL resolver** falls back to the
   prod API hostname when `VITE_API_URL` is missing, so a partial Render
   misconfig doesn't break the deployed bundle.

## Team & roles

- **Tushar (`tush7301`)** — full-stack lead. Map, Feed, Profile, Lists.
  Upstream remote is `tush7301/vouch`.
- **Gaurav (`Acinonyx44`)** — full-stack + infra. Friends/Tastemakers
  systems, Render deploy, populate scripts, this repo.
- **Cynthia, Mandy** — design + demand gen.

The course repo is `kenxle/columbia-startup-studio`; team artifacts live
under `teams/basket-architects/`. The product repo (this one) is separate.
