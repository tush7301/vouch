# CLAUDE.md — Vouch

Project context for Claude (and any AI agent) working in this codebase.
Read this before making changes — most landmines are documented here.

## What this project is

**Vouch** is a social discovery web app for NYC. Users rate places (food,
nightlife, fitness, arts, events, sports) on three dimensions — vibe, value,
experience — and see ratings ranked by friends + tastemakers they trust.

- **Live:** https://vouchnyc-khka.onrender.com
- **API:** https://vouch-api-evyg.onrender.com (`/health`, `/docs`)
- **Render Blueprint:** "vouch" on `tush7301/vouch` @ `main` (recreated 2026-10-25;
  the old `vouchnyc.onrender.com` / `vouch-api-5pa4` services are gone)
- **Google Cloud:** project "Vouch" (`snappy-cistern-490013-i4`) — Places key
  "Vouch Places" + OAuth client "Vouch"
- **Tagline:** *Your social life, ranked.*

Built for Columbia Startup Studio (Spring 2026), team **basket-architects**
(Cynthia Jin · Tushar Mittal · Gaurav Agarwal · Mandy Cheng).

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite 7 + Tailwind CSS 4 + React Router 6 + React Leaflet |
| Map tiles | Esri World Light Gray Canvas (base + reference labels, keyless) |
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
  refresh_photos_only.py    # re-fetches expired photo names (free SKU)
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

Env vars set in the Render dashboard (not in `render.yaml`):
- `vouch-api`: `GOOGLE_PLACES_API_KEY`, `TICKETMASTER_API_KEY`, `GOOGLE_CLIENT_ID`
- `vouchnyc`: `VITE_GOOGLE_CLIENT_ID`

`ADMIN_SECRET` is currently a literal in `render.yaml` (committed) — move it
to `sync: false` and rotate before relying on it.

`vouch-db` is on Render's **free Postgres: it expires 30 days after creation
(~2026-11-24)**, with a 14-day grace period before deletion. Upgrade to
Basic-256mb ($6/mo) or restore a `pg_dump` into a new DB before then. See
README → "Copying data to/from Render" and "Running costs".

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

8. **Frontend `lib/constants.js` API URL resolver** honors any explicit
   `http(s)://` `VITE_API_URL` (so `http://localhost:8001` works) and bare
   hosts containing a dot; bare internal names like `vouch-api-5pa4` are
   rejected. With no usable value it falls back to the prod API hostname
   (`vouch-api-evyg`) off localhost, else `http://localhost:8000`. If the
   Blueprint is recreated, update both this fallback and `VITE_API_URL` in
   `render.yaml`.

9. **Google Places photo names expire.** `cover_photo_url` / `photo_urls`
   store `places.googleapis.com/v1/<photo name>/media?key=...` URLs. Stale
   names return 400 "photo resource … invalid" with any key. Fix with
   `python backend/refresh_photos_only.py` (field mask `photos` only →
   Essentials IDs Only SKU, free). Rotating the Places key also requires a
   refresh, since the key is embedded in every stored URL.

10. **Places cost is driven by field masks.** `search_places` requests
    `editorialSummary` + `rating`, which bills Text Search at the
    Enterprise + Atmosphere tier (~$40/1K); every photo the browser loads
    bills Place Details Photos ($7/1K after 1K free/mo). Trim field masks
    before adding new Places calls; keep a daily quota on the key.

11. **CARTO basemaps now require an API key** (unkeyed tiles render an
    "API KEY REQUIRED" watermark), and OSM's volunteer tile servers block
    app traffic. The map uses Esri Light Gray Canvas instead — keep the
    attribution string in `Map.jsx`.

## Team & roles

- **Tushar (`tush7301`)** — full-stack lead. Map, Feed, Profile, Lists.
  Upstream remote is `tush7301/vouch`.
- **Gaurav (`Acinonyx44`)** — full-stack + infra. Friends/Tastemakers
  systems, Render deploy, populate scripts, this repo.
- **Cynthia, Mandy** — design + demand gen.

The course repo is `kenxle/columbia-startup-studio`; team artifacts live
under `teams/basket-architects/`. The product repo (this one) is separate.
