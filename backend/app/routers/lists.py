"""
Lists router — user-curated collections of experiences.
"""
from typing import List as TList
from uuid import UUID as PyUUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_current_user_optional
from app.database import get_db
from app.models.experience import Experience
from app.models.list import List as UserList, ListItem
from app.models.user import User
from app.schemas.schemas import (
    ExperienceOut,
    ListCreate,
    ListItemOut,
    ListOut,
    ListUpdate,
)

router = APIRouter(prefix="/lists", tags=["lists"])


def _to_out(lst: UserList, item_count: int) -> ListOut:
    return ListOut(
        id=lst.id,
        user_id=lst.user_id,
        name=lst.name,
        description=lst.description or "",
        cover_photo_url=lst.cover_photo_url or "",
        is_public=bool(lst.is_public),
        item_count=item_count,
        created_at=lst.created_at,
        updated_at=lst.updated_at,
    )


@router.get("/", response_model=TList[ListOut])
def get_my_lists(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """All lists owned by the current user, with item counts."""
    rows = (
        db.query(UserList, func.count(ListItem.id).label("item_count"))
        .outerjoin(ListItem, ListItem.list_id == UserList.id)
        .filter(UserList.user_id == current_user.id)
        .group_by(UserList.id)
        .order_by(UserList.updated_at.desc())
        .all()
    )
    return [_to_out(lst, int(count or 0)) for lst, count in rows]


@router.get("/user/{user_id}", response_model=TList[ListOut])
def get_user_lists(
    user_id: PyUUID,
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Public lists for any user (or all lists if viewing your own)."""
    q = (
        db.query(UserList, func.count(ListItem.id).label("item_count"))
        .outerjoin(ListItem, ListItem.list_id == UserList.id)
        .filter(UserList.user_id == user_id)
    )
    if not current_user or current_user.id != user_id:
        q = q.filter(UserList.is_public.is_(True))
    rows = q.group_by(UserList.id).order_by(UserList.updated_at.desc()).all()
    return [_to_out(lst, int(count or 0)) for lst, count in rows]


@router.post("/", response_model=ListOut, status_code=201)
def create_list(
    payload: ListCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new list for the current user."""
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="List name is required")
    lst = UserList(
        user_id=current_user.id,
        name=name[:200],
        description=(payload.description or "")[:2000],
        is_public=payload.is_public if payload.is_public is not None else True,
    )
    db.add(lst)
    db.commit()
    db.refresh(lst)
    return _to_out(lst, 0)


@router.patch("/{list_id}", response_model=ListOut)
def update_list(
    list_id: PyUUID,
    payload: ListUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lst = db.query(UserList).filter(UserList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    if lst.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your list")
    if payload.name is not None:
        lst.name = payload.name.strip()[:200]
    if payload.description is not None:
        lst.description = payload.description[:2000]
    if payload.is_public is not None:
        lst.is_public = payload.is_public
    db.commit()
    db.refresh(lst)
    count = db.query(func.count(ListItem.id)).filter(ListItem.list_id == lst.id).scalar() or 0
    return _to_out(lst, int(count))


@router.delete("/{list_id}", status_code=204)
def delete_list(
    list_id: PyUUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lst = db.query(UserList).filter(UserList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    if lst.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your list")
    db.delete(lst)
    db.commit()
    return None


@router.get("/{list_id}", response_model=ListOut)
def get_list(
    list_id: PyUUID,
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    lst = db.query(UserList).filter(UserList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    is_owner = current_user and current_user.id == lst.user_id
    if not lst.is_public and not is_owner:
        raise HTTPException(status_code=403, detail="Private list")
    count = db.query(func.count(ListItem.id)).filter(ListItem.list_id == lst.id).scalar() or 0
    return _to_out(lst, int(count))


@router.get("/{list_id}/experiences", response_model=TList[ExperienceOut])
def get_list_experiences(
    list_id: PyUUID,
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    lst = db.query(UserList).filter(UserList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    is_owner = current_user and current_user.id == lst.user_id
    if not lst.is_public and not is_owner:
        raise HTTPException(status_code=403, detail="Private list")
    exp_ids = (
        db.query(ListItem.experience_id)
        .filter(ListItem.list_id == list_id)
        .scalar_subquery()
    )
    return (
        db.query(Experience)
        .filter(Experience.id.in_(exp_ids))
        .order_by(Experience.name)
        .all()
    )


@router.post("/{list_id}/items/{experience_id}", response_model=ListItemOut, status_code=201)
def add_item(
    list_id: PyUUID,
    experience_id: PyUUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lst = db.query(UserList).filter(UserList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    if lst.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your list")

    exp = db.query(Experience).filter(Experience.id == experience_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experience not found")

    existing = (
        db.query(ListItem)
        .filter(ListItem.list_id == list_id, ListItem.experience_id == experience_id)
        .first()
    )
    if existing:
        return existing

    item = ListItem(list_id=list_id, experience_id=experience_id)
    db.add(item)
    # Set cover from first item
    if not lst.cover_photo_url and exp.cover_photo_url:
        lst.cover_photo_url = exp.cover_photo_url
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{list_id}/items/{experience_id}", status_code=204)
def remove_item(
    list_id: PyUUID,
    experience_id: PyUUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lst = db.query(UserList).filter(UserList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    if lst.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your list")
    item = (
        db.query(ListItem)
        .filter(ListItem.list_id == list_id, ListItem.experience_id == experience_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not in list")
    db.delete(item)
    db.commit()
    return None
