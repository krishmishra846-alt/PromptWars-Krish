from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from supabase_client import get_supabase_admin
from dependencies import get_current_user, require_admin
import time
import logging

logger = logging.getLogger("argus.schemas")
router = APIRouter(prefix="/api/schemas", tags=["Schemas"])

# In-Memory High Efficiency Cache for Schemas
_SCHEMA_CACHE: Dict[str, Any] = {
    "list": None,
    "last_fetched": 0,
    "items": {}
}
CACHE_TTL_SECONDS = 60.0  # 1 minute cache TTL

def invalidate_schema_cache():
    """Invalidates the in-memory schema cache on mutations."""
    _SCHEMA_CACHE["list"] = None
    _SCHEMA_CACHE["last_fetched"] = 0
    _SCHEMA_CACHE["items"].clear()
    logger.debug("Schema cache invalidated.")

class FieldDefinition(BaseModel):
    name: str = Field(..., min_length=1, max_length=64, description="Key name in JSON")
    label: str = Field(..., min_length=1, max_length=128, description="Display label in form")
    type: str = Field("text", description="Input type: text, number, select, textarea, date, checkbox")
    required: bool = False
    options: Optional[List[str]] = Field(default=None, description="Select options if type is select")
    summarizable: bool = Field(default=False, description="Flag for AI summarization")

class EntitySchemaCreate(BaseModel):
    entity_name: str = Field(..., min_length=2, max_length=64, pattern=r"^[a-z0-9_\-]+$", description="Unique lowercase slug identifier")
    display_name: str = Field(..., min_length=2, max_length=128, description="Human friendly title")
    description: Optional[str] = Field(None, max_length=512)
    icon: Optional[str] = "file-text"
    fields: List[FieldDefinition] = []

@router.get("", response_model=List[Dict[str, Any]])
async def list_schemas():
    """
    Returns all defined entity schemas with in-memory caching for sub-millisecond response times.
    """
    now = time.time()
    if _SCHEMA_CACHE["list"] is not None and (now - _SCHEMA_CACHE["last_fetched"] < CACHE_TTL_SECONDS):
        return _SCHEMA_CACHE["list"]

    try:
        client = get_supabase_admin()
        res = client.table("entity_schemas").select("*").order("created_at", desc=False).execute()
        schemas = res.data or []
        _SCHEMA_CACHE["list"] = schemas
        _SCHEMA_CACHE["last_fetched"] = now
        for s in schemas:
            if s.get("entity_name"):
                _SCHEMA_CACHE["items"][s["entity_name"]] = s
        return schemas
    except Exception as e:
        logger.error("Failed to fetch schemas: %s", str(e))
        if _SCHEMA_CACHE["list"] is not None:
            return _SCHEMA_CACHE["list"]
        raise HTTPException(status_code=500, detail=f"Failed to fetch schemas: {str(e)}")

@router.get("/{entity_name}", response_model=Dict[str, Any])
async def get_schema(entity_name: str):
    """Returns a specific entity schema definition from cache or database."""
    clean_name = entity_name.strip().lower()
    now = time.time()

    if clean_name in _SCHEMA_CACHE["items"] and (now - _SCHEMA_CACHE["last_fetched"] < CACHE_TTL_SECONDS):
        return _SCHEMA_CACHE["items"][clean_name]

    try:
        client = get_supabase_admin()
        res = client.table("entity_schemas").select("*").eq("entity_name", clean_name).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail=f"Schema '{clean_name}' not found")
        item = res.data[0]
        _SCHEMA_CACHE["items"][clean_name] = item
        return item
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error fetching schema '%s': %s", clean_name, str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_or_update_schema(
    payload: EntitySchemaCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Creates or updates an entity schema and invalidates cache for real-time consistency.
    """
    try:
        client = get_supabase_admin()
        schema_data = {
            "entity_name": payload.entity_name.strip().lower(),
            "display_name": payload.display_name.strip(),
            "description": payload.description,
            "icon": payload.icon,
            "fields": [f.model_dump() for f in payload.fields],
            "created_by": current_user["id"]
        }
        res = client.table("entity_schemas").upsert(schema_data).execute()
        invalidate_schema_cache()
        logger.info("Schema '%s' created/updated by user %s", payload.entity_name, current_user.get("id"))
        return {"message": f"Schema '{payload.entity_name}' saved successfully", "data": res.data}
    except Exception as e:
        logger.error("Failed to save schema: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to save schema: {str(e)}")

@router.delete("/{entity_name}")
async def delete_schema(
    entity_name: str,
    _: Dict[str, Any] = Depends(require_admin)
):
    """Deletes an entity schema (Admin only) and invalidates cache."""
    try:
        client = get_supabase_admin()
        client.table("entity_schemas").delete().eq("entity_name", entity_name.strip().lower()).execute()
        invalidate_schema_cache()
        logger.info("Schema '%s' deleted by admin", entity_name)
        return {"message": f"Schema '{entity_name}' deleted"}
    except Exception as e:
        logger.error("Failed to delete schema: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))
