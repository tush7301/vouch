from datetime import datetime
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, EmailStr


# ---------- User ----------
class UserBase(BaseModel):
    email: EmailStr
    username: str
    display_name: str
    bio: Optional[str] = ""
    avatar_url: Optional[str] = ""


class UserCreate(UserBase):
    password: Optional[str] = ""  # empty for OAuth users


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    selected_categories: Optional[str] = None
    onboarding_complete: Optional[bool] = None


class UserOut(UserBase):
    id: UUID
    onboarding_complete: bool
    selected_categories: str
    streak_weeks: str
    is_active: bool
    created_at: datetime
    is_tastemaker: bool = False
    tastemaker_specialty: Optional[str] = ""
    tastemaker_blurb: Optional[str] = ""

    class Config:
        from_attributes = True


# ---------- Experience ----------
class ExperienceBase(BaseModel):
    name: str
    category: str
    subcategory: Optional[str] = ""
    address: Optional[str] = ""
    neighborhood: Optional[str] = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    tags: Optional[str] = ""
    description: Optional[str] = ""
    is_event: Optional[bool] = False


class ExperienceCreate(ExperienceBase):
    google_place_id: Optional[str] = None
    ticketmaster_id: Optional[str] = None
    cover_photo_url: Optional[str] = ""
    event_date: Optional[datetime] = None


class ExperienceOut(ExperienceBase):
    id: UUID
    cover_photo_url: str
    photo_urls: str
    google_place_id: Optional[str]
    ticketmaster_id: Optional[str] = None
    event_date: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Rating ----------
class RatingBase(BaseModel):
    experience_id: UUID
    vibe_score: float
    value_score: float
    experience_score: float
    review_text: Optional[str] = ""
    tags: Optional[str] = ""


class RatingCreate(RatingBase):
    pass


class RatingOut(RatingBase):
    id: UUID
    user_id: UUID
    overall_score: float
    photo_urls: str
    created_at: datetime

    class Config:
        from_attributes = True


class EnrichedRatingOut(BaseModel):
    """Rating with user display info for experience detail pages."""
    id: UUID
    user_id: UUID
    experience_id: UUID
    vibe_score: float
    value_score: float
    experience_score: float
    overall_score: float
    review_text: str
    tags: str
    photo_urls: str
    created_at: datetime
    user_display_name: str
    user_avatar_url: str
    user_username: str
    user_is_tastemaker: bool = False
    user_tastemaker_specialty: Optional[str] = ""

    class Config:
        from_attributes = True


# ---------- Auth ----------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional["UserOut"] = None


class TokenData(BaseModel):
    user_id: Optional[str] = None


class EmailLogin(BaseModel):
    email: EmailStr
    password: str


class EmailRegister(BaseModel):
    email: EmailStr
    username: str
    display_name: str
    password: str


class GoogleAuth(BaseModel):
    credential: str  # Google ID token or auth code


class InstagramAuth(BaseModel):
    code: str  # Instagram OAuth code


# ---------- Follow ----------
class FollowOut(BaseModel):
    id: UUID
    follower_id: UUID
    following_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class FollowUserOut(BaseModel):
    """User summary returned in follower/following lists."""
    id: UUID
    username: str
    display_name: str
    avatar_url: str
    is_tastemaker: bool = False
    tastemaker_specialty: Optional[str] = ""

    class Config:
        from_attributes = True


# ---------- Feed ----------
class FeedRating(BaseModel):
    """Rating with embedded experience + user for feed display."""
    id: UUID
    user_id: UUID
    experience_id: UUID
    vibe_score: float
    value_score: float
    experience_score: float
    overall_score: float
    review_text: str
    tags: str
    photo_urls: str
    created_at: datetime

    class Config:
        from_attributes = True


class FeedItem(BaseModel):
    type: str  # friend_activity | vouch_pick | trending
    rating: Optional[FeedRating] = None
    experience: Optional[ExperienceOut] = None
    user: Optional[FollowUserOut] = None
    time_ago: Optional[str] = None


class FeedResponse(BaseModel):
    items: List[FeedItem]
    next_cursor: Optional[str] = None


# ---------- Wishlist ----------
class WishlistOut(BaseModel):
    id: UUID
    user_id: UUID
    experience_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Lists ----------
class ListCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    is_public: Optional[bool] = True


class ListUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None


class ListItemOut(BaseModel):
    id: UUID
    experience_id: UUID
    note: str = ""
    created_at: datetime

    class Config:
        from_attributes = True


class ListOut(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    description: str = ""
    cover_photo_url: str = ""
    is_public: bool = True
    item_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------- Rating Update ----------
class RatingUpdate(BaseModel):
    vibe_score: Optional[float] = None
    value_score: Optional[float] = None
    experience_score: Optional[float] = None
    review_text: Optional[str] = None
    tags: Optional[str] = None


# ---------- Profile ----------
class ProfileStatsOut(BaseModel):
    rating_count: int
    follower_count: int
    following_count: int
    wishlist_count: int
    avg_overall_score: Optional[float] = None


class ProfileRatingOut(BaseModel):
    id: UUID
    user_id: UUID
    experience_id: UUID
    experience_name: str
    experience_category: str
    experience_cover_photo: str
    experience_address: str
    experience_neighborhood: str
    vibe_score: float
    value_score: float
    experience_score: float
    overall_score: float
    review_text: str
    tags: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Map ----------
class MapPinOut(BaseModel):
    id: UUID
    name: str
    category: str
    latitude: float
    longitude: float
    address: str
    neighborhood: str
    cover_photo_url: str
    avg_score: float
    num_ratings: int


class NeighborhoodOut(BaseModel):
    name: str
    experience_count: int
    avg_score: float


class LocateResult(BaseModel):
    """Resolved location for the map's "explore near X" feature."""
    label: str                  # human-readable (e.g. "SoHo, Manhattan, NY")
    latitude: float
    longitude: float
    radius_km: float            # suggested radius for the area
    source: str                 # "db" | "geocode" — useful for debugging/UX
    experience_count: int = 0   # how many existing experiences fell in the area


# ---------- Misc ----------
class HealthCheck(BaseModel):
    status: str = "ok"
    version: str
