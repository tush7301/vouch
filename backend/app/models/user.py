import uuid
from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    bio = Column(Text, default="")
    avatar_url = Column(String(500), default="")
    hashed_password = Column(String(255), default="")  # empty for OAuth-only users

    # OAuth identifiers
    google_id = Column(String(255), unique=True, nullable=True)
    instagram_id = Column(String(255), unique=True, nullable=True)

    # Onboarding
    onboarding_complete = Column(Boolean, default=False)
    selected_categories = Column(Text, default="")  # comma-separated

    # Gamification
    streak_weeks = Column(String(10), default="0")
    badge_ids = Column(Text, default="")  # comma-separated badge ids

    # Tastemaker — curated/verified accounts that solve cold-start by giving
    # new users high-signal people to follow from day 1.
    is_tastemaker = Column(Boolean, default=False, nullable=False, index=True)
    tastemaker_specialty = Column(String(100), default="")  # e.g. "Food Critic", "Nightlife"
    tastemaker_blurb = Column(String(300), default="")      # short bio for tastemaker card

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships (lazy-loaded, defined via back_populates in child models)
    ratings = relationship("Rating", back_populates="user", lazy="dynamic")
    wishlists = relationship("Wishlist", back_populates="user", lazy="dynamic")
    lists = relationship("List", back_populates="user", lazy="dynamic")

    def __repr__(self):
        return f"<User {self.username}>"
