import json
import logging
from typing import List, Optional

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, or_, case
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.items import Items
from models.claims import Claims
from models.notifications import Notifications
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/hub", tags=["hub"])


# ---------- Schemas ----------
class ItemResponse(BaseModel):
    id: int
    user_id: str
    title: str
    description: Optional[str] = None
    category: str
    type: str
    images: Optional[str] = None
    location: Optional[str] = None
    status: str
    priority: str
    contact_info: Optional[str] = None
    reunited_at: Optional[datetime] = None
    reunited_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ItemListResponse(BaseModel):
    items: List[ItemResponse]
    total: int
    skip: int
    limit: int


class ClaimCreateRequest(BaseModel):
    item_id: int
    message: str = ""


class ClaimResponse(BaseModel):
    id: int
    user_id: str
    item_id: int
    message: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: int
    user_id: str
    message: str
    is_read: bool
    related_item_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DashboardResponse(BaseModel):
    total_posts: int
    active_posts: int
    claimed_items: int
    pending_claims: int


class StatsResponse(BaseModel):
    total_lost_items: int
    total_found_items: int
    total_claimed: int


# ---------- Public Endpoints ----------
@router.get("/items", response_model=ItemListResponse)
async def get_all_items(
    category: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort: Optional[str] = Query(None, description="Sort: -created_at, priority_first"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint to list all items with filtering"""
    try:
        query = select(Items)
        count_query = select(func.count(Items.id))

        if category:
            query = query.where(Items.category == category)
            count_query = count_query.where(Items.category == category)
        if type:
            query = query.where(Items.type == type)
            count_query = count_query.where(Items.type == type)
        if status:
            query = query.where(Items.status == status)
            count_query = count_query.where(Items.status == status)
        if priority:
            query = query.where(Items.priority == priority)
            count_query = count_query.where(Items.priority == priority)
        if search:
            search_filter = or_(
                Items.title.ilike(f"%{search}%"),
                Items.description.ilike(f"%{search}%")
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)

        count_result = await db.execute(count_query)
        total = count_result.scalar()

        if sort == "priority_first":
            priority_order = case(
                (Items.priority == "Urgent", 0),
                else_=1
            )
            query = query.order_by(priority_order, Items.created_at.desc())
        elif sort and sort.startswith("-"):
            field_name = sort[1:]
            if hasattr(Items, field_name):
                query = query.order_by(getattr(Items, field_name).desc())
            else:
                query = query.order_by(Items.created_at.desc())
        else:
            query = query.order_by(Items.created_at.desc())

        result = await db.execute(query.offset(skip).limit(limit))
        items = result.scalars().all()

        return {"items": items, "total": total, "skip": skip, "limit": limit}
    except Exception as e:
        logger.error(f"Error fetching items: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/items/{item_id}", response_model=ItemResponse)
async def get_item_detail(
    item_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint to get item detail"""
    try:
        result = await db.execute(select(Items).where(Items.id == item_id))
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        return item
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching item {item_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats", response_model=StatsResponse)
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Public endpoint to get platform stats"""
    try:
        lost_result = await db.execute(
            select(func.count(Items.id)).where(Items.type == "Lost")
        )
        total_lost = lost_result.scalar() or 0

        found_result = await db.execute(
            select(func.count(Items.id)).where(Items.type == "Found")
        )
        total_found = found_result.scalar() or 0

        claimed_result = await db.execute(
            select(func.count(Items.id)).where(or_(Items.status == "Reunited", Items.status == "Claimed"))
        )
        total_claimed = claimed_result.scalar() or 0

        return {
            "total_lost_items": total_lost,
            "total_found_items": total_found,
            "total_claimed": total_claimed,
        }
    except Exception as e:
        logger.error(f"Error fetching stats: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ---------- Authenticated Endpoints ----------
@router.post("/claims", response_model=ClaimResponse, status_code=201)
async def create_claim(
    data: ClaimCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a claim on an item and notify the owner"""
    try:
        # Get the item
        item_result = await db.execute(select(Items).where(Items.id == data.item_id))
        item = item_result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        if item.user_id == str(current_user.id):
            raise HTTPException(status_code=400, detail="Cannot claim your own item")

        if item.status != "Active":
            raise HTTPException(status_code=400, detail="Item is no longer active")

        # Create the claim
        claim = Claims(
            user_id=str(current_user.id),
            item_id=data.item_id,
            message=data.message,
            status="Pending",
        )
        db.add(claim)

        # Create notification for item owner
        notification = Notifications(
            user_id=item.user_id,
            message=f"Someone has claimed your {item.type.lower()} item: {item.title}",
            is_read=False,
            related_item_id=item.id,
        )
        db.add(notification)

        await db.commit()
        await db.refresh(claim)
        return claim
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating claim: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/claims/item/{item_id}", response_model=List[ClaimResponse])
async def get_item_claims(
    item_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all claims for an item (only item owner can see)"""
    try:
        # Verify ownership
        item_result = await db.execute(select(Items).where(Items.id == item_id))
        item = item_result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        if item.user_id != str(current_user.id):
            raise HTTPException(status_code=403, detail="Not authorized")

        result = await db.execute(
            select(Claims).where(Claims.item_id == item_id).order_by(Claims.created_at.desc())
        )
        return result.scalars().all()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching claims: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/claims/{claim_id}/approve")
async def approve_claim(
    claim_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve a claim (item owner only)"""
    try:
        claim_result = await db.execute(select(Claims).where(Claims.id == claim_id))
        claim = claim_result.scalar_one_or_none()
        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found")

        # Verify item ownership
        item_result = await db.execute(select(Items).where(Items.id == claim.item_id))
        item = item_result.scalar_one_or_none()
        if not item or item.user_id != str(current_user.id):
            raise HTTPException(status_code=403, detail="Not authorized")

        claim.status = "Approved"
        item.status = "Reunited"
        item.reunited_at = datetime.now(timezone.utc)
        item.reunited_by = claim.user_id

        # Notify claimant
        notification = Notifications(
            user_id=claim.user_id,
            message=f"Your claim for '{item.title}' has been approved!",
            is_read=False,
            related_item_id=item.id,
        )
        db.add(notification)

        await db.commit()
        return {"message": "Claim approved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error approving claim: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/claims/{claim_id}/reject")
async def reject_claim(
    claim_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject a claim (item owner only)"""
    try:
        claim_result = await db.execute(select(Claims).where(Claims.id == claim_id))
        claim = claim_result.scalar_one_or_none()
        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found")

        item_result = await db.execute(select(Items).where(Items.id == claim.item_id))
        item = item_result.scalar_one_or_none()
        if not item or item.user_id != str(current_user.id):
            raise HTTPException(status_code=403, detail="Not authorized")

        claim.status = "Rejected"

        notification = Notifications(
            user_id=claim.user_id,
            message=f"Your claim for '{item.title}' has been rejected.",
            is_read=False,
            related_item_id=item.id,
        )
        db.add(notification)

        await db.commit()
        return {"message": "Claim rejected successfully"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error rejecting claim: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user's notifications"""
    try:
        result = await db.execute(
            select(Notifications)
            .where(Notifications.user_id == str(current_user.id))
            .order_by(Notifications.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()
    except Exception as e:
        logger.error(f"Error fetching notifications: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/notifications/unread-count")
async def get_unread_count(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get count of unread notifications"""
    try:
        result = await db.execute(
            select(func.count(Notifications.id)).where(
                Notifications.user_id == str(current_user.id),
                Notifications.is_read == False,
            )
        )
        count = result.scalar() or 0
        return {"count": count}
    except Exception as e:
        logger.error(f"Error fetching unread count: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a notification as read"""
    try:
        result = await db.execute(
            select(Notifications).where(
                Notifications.id == notification_id,
                Notifications.user_id == str(current_user.id),
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")

        notification.is_read = True
        await db.commit()
        return {"message": "Notification marked as read"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error marking notification read: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/notifications/read-all")
async def mark_all_read(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read"""
    try:
        from sqlalchemy import update
        await db.execute(
            update(Notifications)
            .where(
                Notifications.user_id == str(current_user.id),
                Notifications.is_read == False,
            )
            .values(is_read=True)
        )
        await db.commit()
        return {"message": "All notifications marked as read"}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error marking all read: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user's dashboard stats"""
    try:
        user_id = str(current_user.id)

        # Total posts
        total_result = await db.execute(
            select(func.count(Items.id)).where(Items.user_id == user_id)
        )
        total_posts = total_result.scalar() or 0

        # Active posts
        active_result = await db.execute(
            select(func.count(Items.id)).where(
                Items.user_id == user_id, Items.status == "Active"
            )
        )
        active_posts = active_result.scalar() or 0

        # Claimed items
        claimed_result = await db.execute(
            select(func.count(Items.id)).where(
                Items.user_id == user_id, Items.status == "Claimed"
            )
        )
        claimed_items = claimed_result.scalar() or 0

        # Pending claims on user's items
        pending_result = await db.execute(
            select(func.count(Claims.id)).where(
                Claims.item_id.in_(
                    select(Items.id).where(Items.user_id == user_id)
                ),
                Claims.status == "Pending",
            )
        )
        pending_claims = pending_result.scalar() or 0

        return {
            "total_posts": total_posts,
            "active_posts": active_posts,
            "claimed_items": claimed_items,
            "pending_claims": pending_claims,
        }
    except Exception as e:
        logger.error(f"Error fetching dashboard: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))