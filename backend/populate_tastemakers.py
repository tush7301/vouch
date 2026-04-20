"""
Seed the database with Vouch tastemaker (influencer) accounts and their ratings.

Usage:
    cd backend && python populate_tastemakers.py

Creates 6 tastemaker users, each seeded with up to 8 ratings on experiences that
match their specialty. All accounts share the password VouchUser2026!.

Re-running is idempotent: existing users are re-used, only missing ratings are
inserted.
"""
import random
import sys
import os
import uuid

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, func
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.config import settings
from app.models.experience import Experience
from app.models.rating import Rating
from app.models.user import User


# Shared password for all tastemaker accounts.
TASTEMAKER_PASSWORD = "VouchUser2026!"

# Tastemaker user definitions (from Vouch_Tastemaker_DB_Entries.pdf).
TASTEMAKERS = [
    {
        "username": "maya_eats_nyc",
        "display_name": "Maya Chen",
        "email": "maya.chen.tastemaker@vouch.app",
        "specialty": "Food Critic",
        "blurb": "Former Eater editor. I eat 4 meals a day so you don't have to.",
        "categories": ["Food & Drink"],
    },
    {
        "username": "dj_marquis_nyc",
        "display_name": "Marquis Daniels",
        "email": "marquis.dj.tastemaker@vouch.app",
        "specialty": "Nightlife",
        "blurb": "DJ + nightlife photographer. If the bouncer doesn't know me, I don't go.",
        "categories": ["Social Scenes", "Live Events"],
    },
    {
        "username": "aisha_artwalks",
        "display_name": "Aisha Okonkwo",
        "email": "aisha.art.tastemaker@vouch.app",
        "specialty": "Arts & Culture",
        "blurb": "Independent curator. I'll save you from the tourist traps.",
        "categories": ["Arts & Culture"],
    },
    {
        "username": "kai_moves",
        "display_name": "Kai Tanaka",
        "email": "kai.fitness.tastemaker@vouch.app",
        "specialty": "Fitness & Wellness",
        "blurb": "NASM trainer. Studios, gyms, recovery — I've tried them all.",
        "categories": ["Wellness & Fitness"],
    },
    {
        "username": "sam_sees_shows",
        "display_name": "Sam Berkowitz",
        "email": "sam.music.tastemaker@vouch.app",
        "specialty": "Live Music",
        "blurb": "200+ shows a year. From Bowery Ballroom to bedroom DIY.",
        "categories": ["Live Events"],
    },
    {
        "username": "eli_finds_gems",
        "display_name": "Eli Park",
        "email": "eli.hidden.tastemaker@vouch.app",
        "specialty": "Hidden Gems",
        "blurb": "I find the spots before TikTok ruins them. Trust the process.",
        "categories": ["Food & Drink", "Social Scenes", "Arts & Culture"],
    },
]


# 5 specialty-tuned reviews each, rotated at random per rating.
REVIEW_BANKS = {
    "Food Critic": [
        "Technique on point — the seasoning hierarchy is spot-on, no one note overpowers. Order the chef's tasting if available.",
        "Best version of this dish in the city right now. The acid balance is the giveaway — most places overshoot.",
        "Service has the cadence right: attentive without hovering. Wine pairings are thoughtful, not just upselling.",
        "Hits the sweet spot of consistent + ambitious. Three visits, three home runs. Hard to do.",
        "The fundamentals are dialed: bread, butter, water all premium. That tells you everything before you order.",
    ],
    "Nightlife": [
        "Sound system is the move — actual subs, not just volume. Crowd skews regulars over tourists by 11pm.",
        "Bar program is sneaky-good. Don't sleep on the back room when the main floor gets crowded.",
        "Door's tight but fair. Bring a small group, dress like you mean it, you're good.",
        "Energy peaks 1-2am. Get there early, stake out a corner, ride the wave.",
        "DJ booking is consistently A-tier. Few venues this size get the talent they get.",
    ],
    "Arts & Culture": [
        "Curation is intentional — every piece earns its wall space. Stay for the room transitions, that's where the story lives.",
        "Best small museum experience in the borough. Two hours minimum, three if you read every label.",
        "The lighting design alone is worth the visit. Notice how it shifts with the daylight.",
        "Programming this season is a standout. Talk to the docents — they know more than the wall text shows.",
        "Underrated gem. Go on a Tuesday morning, you'll basically have it to yourself.",
    ],
    "Fitness & Wellness": [
        "Equipment is dialed and well-maintained. The pulleys actually feel right, which is rare.",
        "Coaching cues are excellent — they correct form without making you feel called out. Newbies welcome.",
        "Recovery setup (sauna, cold) is legit, not an afterthought. Plan to stay 30 min after your session.",
        "Class structure has real progression. Six weeks in I can see and feel the difference.",
        "Community is the real value. I've made friends here, which I didn't expect.",
    ],
    "Live Music": [
        "Soundboard mix was perfect — vocals sat right on top of the band, no mud. Rare for this size venue.",
        "Sightlines are great from the back balcony. Skip the floor unless you're up front.",
        "Acoustics in this room are doing a lot of the work. Even mid-tier acts sound great here.",
        "Get there for the opener. Bookings here are tight — the openers usually deserve the headline slot.",
        "Bar moves fast even on sold-out nights. Staff actually care about you not missing songs.",
    ],
    "Hidden Gems": [
        "Off the algorithm. Walk in, no line, and the quality is genuinely there. This is the play.",
        "Locals-only energy. Be respectful, tip well, don't post the address. We protect this one.",
        "Found it by accident, came back four times. Tells you everything.",
        "The kind of spot that gets ruined when it goes viral. Enjoy it now.",
        "Quiet hours: weekday afternoons. That's when the magic happens.",
    ],
}

MAX_RATINGS_PER_TASTEMAKER = 8


def upsert_tastemaker(session: Session, tm: dict) -> User:
    """Create or update a tastemaker user."""
    user = session.query(User).filter(User.username == tm["username"]).first()
    if user:
        # Make sure the tastemaker metadata stays in sync.
        user.is_tastemaker = True
        user.tastemaker_specialty = tm["specialty"]
        user.tastemaker_blurb = tm["blurb"]
        user.display_name = tm["display_name"]
        user.onboarding_complete = True
        session.commit()
        print(f"  ↺ reuse {tm['username']}")
        return user

    user = User(
        id=uuid.uuid4(),
        username=tm["username"],
        display_name=tm["display_name"],
        email=tm["email"],
        hashed_password=hash_password(TASTEMAKER_PASSWORD),
        is_tastemaker=True,
        tastemaker_specialty=tm["specialty"],
        tastemaker_blurb=tm["blurb"],
        onboarding_complete=True,
        selected_categories=",".join(tm["categories"]),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    print(f"  + new  {tm['username']}")
    return user


def seed_ratings_for(session: Session, user: User, tm: dict) -> int:
    """Seed up to MAX_RATINGS_PER_TASTEMAKER ratings on category-matching experiences."""
    # Experiences already rated by this user (idempotency).
    already_rated = {
        r.experience_id
        for r in session.query(Rating.experience_id)
        .filter(Rating.user_id == user.id)
        .all()
    }

    existing_count = len(already_rated)
    needed = MAX_RATINGS_PER_TASTEMAKER - existing_count
    if needed <= 0:
        return 0

    # Pull candidate experiences matching the tastemaker's categories.
    # Prefer ones that have coordinates (so they show on the map).
    candidates = (
        session.query(Experience)
        .filter(Experience.category.in_(tm["categories"]))
        .filter(Experience.latitude.isnot(None), Experience.longitude.isnot(None))
        .order_by(func.random())
        .limit(needed * 3)  # over-fetch then filter by not-already-rated
        .all()
    )

    review_bank = REVIEW_BANKS.get(tm["specialty"], [])
    inserted = 0
    for exp in candidates:
        if inserted >= needed:
            break
        if exp.id in already_rated:
            continue

        vibe = round(random.uniform(7.5, 9.5), 1)
        value = round(random.uniform(7.0, 9.5), 1)
        experience = round(random.uniform(7.5, 9.5), 1)
        overall = round((vibe + value + experience) / 3.0, 1)

        review = random.choice(review_bank) if review_bank else ""

        rating = Rating(
            id=uuid.uuid4(),
            user_id=user.id,
            experience_id=exp.id,
            vibe_score=vibe,
            value_score=value,
            experience_score=experience,
            overall_score=overall,
            review_text=review,
            tags="",
        )
        session.add(rating)
        already_rated.add(exp.id)
        inserted += 1

    session.commit()
    return inserted


def main():
    engine = create_engine(settings.DATABASE_URL)
    total_new_users = 0
    total_ratings = 0

    with Session(engine) as session:
        for tm in TASTEMAKERS:
            print(f"\n=== {tm['display_name']} · {tm['specialty']} ===")
            before_count = session.query(func.count(User.id)).filter(
                User.username == tm["username"]
            ).scalar()
            user = upsert_tastemaker(session, tm)
            if before_count == 0:
                total_new_users += 1
            n = seed_ratings_for(session, user, tm)
            total_ratings += n
            print(f"  + {n} ratings seeded")

    print("\n============ SUMMARY ============")
    print(f"New tastemakers:  {total_new_users}")
    print(f"Ratings inserted: {total_ratings}")
    print(f"Shared password:  {TASTEMAKER_PASSWORD}")


if __name__ == "__main__":
    main()
