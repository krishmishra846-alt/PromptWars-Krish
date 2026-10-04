from fastapi import APIRouter, HTTPException, Depends, status, Query, Response
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import json
import csv
import io
import logging
from supabase_client import get_supabase_admin
from dependencies import get_current_user, get_optional_user
from security_utils import sanitize_text, sanitize_json_payload, validate_entity_slug, get_safe_error_detail
from .telegram_bot import notify_new_record_created

logger = logging.getLogger("argus.entities")
router = APIRouter(prefix="/api/entities", tags=["Entities"])

class EntityRecordCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=256, description="Primary headline / identifier")
    data: Dict[str, Any] = Field(default_factory=dict, description="Dynamic field values mapped to schema")
    status: Optional[str] = Field("active", max_length=64)
    file_urls: Optional[List[str]] = Field(default_factory=list)

class EntityRecordUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=256)
    data: Optional[Dict[str, Any]] = None
    status: Optional[str] = Field(None, max_length=64)
    file_urls: Optional[List[str]] = None
    ai_summary: Optional[str] = None

def record_audit(entity_name: str, record_id: str, user_id: str, action: str, old_data: Any = None, new_data: Any = None):
    """Utility to append an immutable audit log entry."""
    try:
        client = get_supabase_admin()
        client.table("audit_log").insert({
            "entity_name": entity_name,
            "record_id": record_id,
            "user_id": user_id,
            "action": action,
            "old_data": old_data,
            "new_data": new_data
        }).execute()
    except Exception as e:
        logger.warning("Audit log write warning: %s", str(e))

@router.get("/audit/all")
async def get_all_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Fetches system audit logs strictly filtered to current user unless admin."""
    try:
        client = get_supabase_admin()
        query = client.table("audit_log").select("*, profiles(full_name, email)")
        if current_user.get("role") != "admin":
            query = query.eq("user_id", current_user["id"])
        res = query.order("created_at", desc=True).limit(limit).execute()
        return res.data or []
    except Exception as e:
        logger.error("Failed to fetch audit logs: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit logs: {str(e)}")

@router.get("/{entity_name}")
async def list_records(
    entity_name: str,
    response: Response,
    search: Optional[str] = Query(None, description="Search keyword in title"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100, description="Pagination page size"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    scope: Optional[str] = Query(None, description="Set to 'all' for admin compliance overview"),
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    """
    Lists records for a given entity type with server-side pagination, search, and strict email data isolation.
    Returns array of records and sets 'X-Total-Count' response header.
    """
    try:
        client = get_supabase_admin()
        query = client.table("generic_entities").select("*, profiles(full_name, email)", count="exact").eq("entity_name", entity_name)

        if not current_user or not current_user.get("id"):
            response.headers["X-Total-Count"] = "0"
            return []

        # STRICT MULTI-TENANT ISOLATION BY EMAIL/USER:
        # Every email strictly owns its own data. Data of one email NEVER enters another email's view.
        # Only if current user is admin AND specifically passes scope='all' do they see cross-tenant data.
        if current_user.get("role") == "admin" and scope == "all":
            pass  # Admin global inspection
        else:
            query = query.eq("owner_id", current_user["id"])

        if status:
            query = query.eq("status", status)

        if search:
            # Case-insensitive title search
            query = query.ilike("title", f"%{search.strip()}%")

        res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        total_count = res.count if res.count is not None else len(res.data or [])
        response.headers["X-Total-Count"] = str(total_count)
        
        return res.data or []
    except Exception as e:
        logger.error("Failed to fetch records for %s: %s", entity_name, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to fetch records: {str(e)}")

@router.get("/{entity_name}/export/csv")
async def export_records_csv(
    entity_name: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Exports records of the entity to CSV format strictly for the authenticated user's email."""
    try:
        client = get_supabase_admin()
        # Strictly isolate export to current user's email records
        query = client.table("generic_entities").select("*").eq("entity_name", entity_name).eq("owner_id", current_user["id"])
        res = query.order("created_at", desc=True).execute()
        rows = res.data or []

        if not rows:
            return Response(content="No records found", media_type="text/csv")

        output = io.StringIO()
        data_keys = set()
        for r in rows:
            if isinstance(r.get("data"), dict):
                data_keys.update(r["data"].keys())
        
        fieldnames = ["id", "title", "status", "created_at", "ai_summary"] + sorted(list(data_keys))
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()

        for r in rows:
            flat_row = {
                "id": r.get("id"),
                "title": r.get("title"),
                "status": r.get("status"),
                "created_at": r.get("created_at"),
                "ai_summary": r.get("ai_summary", "")
            }
            if isinstance(r.get("data"), dict):
                for k in data_keys:
                    flat_row[k] = r["data"].get(k, "")
            writer.writerow(flat_row)

        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={entity_name}_export.csv"}
        )
    except Exception as e:
        logger.error("CSV Export error for %s: %s", entity_name, str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{entity_name}/{record_id}")
async def get_record(
    entity_name: str,
    record_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Gets a specific record and its associated audit trail."""
    try:
        client = get_supabase_admin()
        res = client.table("generic_entities").select("*, profiles(full_name, email)").eq("id", record_id).eq("entity_name", entity_name).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Record not found")
        
        record = res.data[0]
        # User isolation check
        if current_user.get("role") != "admin" and record.get("owner_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied to this record")

        # Fetch audit history for this record
        audit_res = client.table("audit_log").select("*, profiles(full_name, email)").eq("record_id", record_id).order("created_at", desc=True).execute()

        return {
            "record": record,
            "audit_trail": audit_res.data or []
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error fetching record %s: %s", record_id, str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{entity_name}", status_code=status.HTTP_201_CREATED)
async def create_record(
    entity_name: str,
    payload: EntityRecordCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Creates a new record for the entity and records an audit log entry."""
    try:
        if not validate_entity_slug(entity_name):
            raise HTTPException(status_code=400, detail="Invalid entity name slug format.")

        client = get_supabase_admin()
        insert_data = {
            "entity_name": entity_name,
            "title": sanitize_text(payload.title),
            "data": sanitize_json_payload(payload.data),
            "status": sanitize_text(payload.status or "active"),
            "file_urls": payload.file_urls or [],
            "owner_id": current_user["id"]
        }
        res = client.table("generic_entities").insert(insert_data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to insert record")

        created_record = res.data[0]
        record_audit(
            entity_name=entity_name,
            record_id=created_record["id"],
            user_id=current_user["id"],
            action="CREATE",
            new_data=insert_data
        )

        # Notify Telegram Bot of new record creation
        try:
            user_name = current_user.get("full_name") or current_user.get("email") or "Operator"
            await notify_new_record_created(
                entity_name=entity_name,
                title=created_record.get("title", payload.title),
                record_data=payload.data or {},
                status_val=created_record.get("status", payload.status or "active"),
                user_name=user_name,
                file_urls=payload.file_urls or [],
                ai_summary=created_record.get("ai_summary", "")
            )
        except Exception:
            pass

        return created_record
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Create record error: %s", str(e))
        raise HTTPException(status_code=500, detail=get_safe_error_detail(e, "Failed to create record."))

@router.put("/{entity_name}/{record_id}")
async def update_record(
    entity_name: str,
    record_id: str,
    payload: EntityRecordUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Updates an existing record. Restricted to owner or admin."""
    try:
        if not validate_entity_slug(entity_name):
            raise HTTPException(status_code=400, detail="Invalid entity name slug format.")

        client = get_supabase_admin()
        existing = client.table("generic_entities").select("*").eq("id", record_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Record not found")

        old_row = existing.data[0]
        if current_user.get("role") != "admin" and old_row.get("owner_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to edit this record")

        updates: Dict[str, Any] = {}
        if payload.title is not None:
            updates["title"] = sanitize_text(payload.title)
        if payload.data is not None:
            clean_patch = sanitize_json_payload(payload.data)
            merged_data = {**(old_row.get("data") or {}), **clean_patch}
            updates["data"] = merged_data
        if payload.status is not None:
            updates["status"] = sanitize_text(payload.status)
        if payload.file_urls is not None:
            updates["file_urls"] = payload.file_urls
        if payload.ai_summary is not None:
            updates["ai_summary"] = sanitize_text(payload.ai_summary)

        updates["updated_at"] = "now()"

        res = client.table("generic_entities").update(updates).eq("id", record_id).execute()
        updated_row = res.data[0] if res.data else None

        record_audit(
            entity_name=entity_name,
            record_id=record_id,
            user_id=current_user["id"],
            action="UPDATE",
            old_data=old_row,
            new_data=updates
        )

        return updated_row
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Update record error: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{entity_name}/{record_id}")
async def delete_record(
    entity_name: str,
    record_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Deletes an entity record. Restricted to owner or admin."""
    try:
        if not validate_entity_slug(entity_name):
            raise HTTPException(status_code=400, detail="Invalid entity name slug format.")

        client = get_supabase_admin()
        existing = client.table("generic_entities").select("*").eq("id", record_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Record not found")

        old_row = existing.data[0]
        if current_user.get("role") != "admin" and old_row.get("owner_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to delete this record")

        client.table("generic_entities").delete().eq("id", record_id).execute()

        record_audit(
            entity_name=entity_name,
            record_id=record_id,
            user_id=current_user["id"],
            action="DELETE",
            old_data=old_row
        )

        return {"message": "Record deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Delete record error: %s", str(e))
        raise HTTPException(status_code=500, detail=get_safe_error_detail(e, "Failed to delete record."))
