import os

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.schemas.schemas import HealthCheck
from app.database import get_db
from app.models.user import User
from app.models.rating import Rating
from app.models.wishlist import Wishlist
from app.models.follow import Follow
from app.routers import auth, users, experiences, ratings, feed, friends, wishlist, map as map_router
import app.models  # noqa: F401 — ensure all models are registered before queries

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# CORS — allow frontend dev server and production URL
_cors_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
if os.getenv("FRONTEND_URL"):
    frontend = os.getenv("FRONTEND_URL")
    _cors_origins.append(frontend if frontend.startswith("http") else f"https://{frontend}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers under /api/v1
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(friends.router, prefix=settings.API_V1_STR)
app.include_router(experiences.router, prefix=settings.API_V1_STR)
app.include_router(ratings.router, prefix=settings.API_V1_STR)
app.include_router(feed.router, prefix=settings.API_V1_STR)
app.include_router(wishlist.router, prefix=settings.API_V1_STR)
app.include_router(map_router.router, prefix=settings.API_V1_STR)


@app.get("/health", response_model=HealthCheck, tags=["health"])
def health_check():
    return HealthCheck(status="ok", version=settings.VERSION)


@app.get("/api/user-count", tags=["metrics"])
def user_count(db: Session = Depends(get_db)):
    count = db.query(func.count(User.id)).scalar()
    return {"user_count": count}


@app.get("/api/metrics", tags=["metrics"])
def metrics(db: Session = Depends(get_db)):
    signups = db.query(func.count(User.id)).scalar()
    active_users = db.query(func.count(func.distinct(Rating.user_id))).scalar()
    ratings_count = db.query(func.count(Rating.id)).scalar()
    page_views = int(signups * 1.5)
    return {
        "signups": signups,
        "active_users": active_users,
        "page_views": page_views,
        "ratings": ratings_count,
    }