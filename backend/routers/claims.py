import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.claims import ClaimsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/claims", tags=["claims"])


# ---------- Pydantic Schemas ----------
class ClaimsData(BaseModel):
    """Entity data schema (for create/update)"""
    item_id: int
    message: str = None
    status: str


class ClaimsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    item_id: Optional[int] = None
    message: Optional[str] = None
    status: Optional[str] = None


class ClaimsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    item_id: int
    message: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ClaimsListResponse(BaseModel):
    """List response schema"""
    items: List[ClaimsResponse]
    total: int
    skip: int
    limit: int


class ClaimsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[ClaimsData]


class ClaimsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: ClaimsUpdateData


class ClaimsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[ClaimsBatchUpdateItem]


class ClaimsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=ClaimsListResponse)
async def query_claimss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query claimss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying claimss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = ClaimsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
            user_id=str(current_user.id),
        )
        logger.debug(f"Found {result['total']} claimss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying claimss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=ClaimsListResponse)
async def query_claimss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query claimss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying claimss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = ClaimsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} claimss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying claimss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=ClaimsResponse)
async def get_claims(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single claims by ID (user can only see their own records)"""
    logger.debug(f"Fetching claims with id: {id}, fields={fields}")
    
    service = ClaimsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Claims with id {id} not found")
            raise HTTPException(status_code=404, detail="Claims not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching claims {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=ClaimsResponse, status_code=201)
async def create_claims(
    data: ClaimsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new claims"""
    logger.debug(f"Creating new claims with data: {data}")
    
    service = ClaimsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create claims")
        
        logger.info(f"Claims created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating claims: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating claims: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[ClaimsResponse], status_code=201)
async def create_claimss_batch(
    request: ClaimsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple claimss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} claimss")
    
    service = ClaimsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} claimss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[ClaimsResponse])
async def update_claimss_batch(
    request: ClaimsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple claimss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} claimss")
    
    service = ClaimsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} claimss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=ClaimsResponse)
async def update_claims(
    id: int,
    data: ClaimsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing claims (requires ownership)"""
    logger.debug(f"Updating claims {id} with data: {data}")

    service = ClaimsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Claims with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Claims not found")
        
        logger.info(f"Claims {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating claims {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating claims {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_claimss_batch(
    request: ClaimsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple claimss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} claimss")
    
    service = ClaimsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} claimss successfully")
        return {"message": f"Successfully deleted {deleted_count} claimss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_claims(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single claims by ID (requires ownership)"""
    logger.debug(f"Deleting claims with id: {id}")
    
    service = ClaimsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Claims with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Claims not found")
        
        logger.info(f"Claims {id} deleted successfully")
        return {"message": "Claims deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting claims {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")