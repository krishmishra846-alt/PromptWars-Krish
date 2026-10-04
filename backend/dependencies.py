from fastapi import Header, HTTPException, status, Depends
from typing import Optional, Dict, Any
from supabase_client import get_supabase, get_supabase_admin
from config import settings
import logging

logger = logging.getLogger("uvicorn.error")

async def get_optional_user(
    authorization: Optional[str] = Header(None)
) -> Optional[Dict[str, Any]]:
    """Extracts and verifies Supabase user if Authorization header is present, else None."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return await get_current_user(authorization=authorization)
    except Exception:
        return None

async def get_current_user(
    authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    Extracts Bearer token, validates it against Supabase Auth,
    and fetches user details and role dynamically from the profiles table.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = authorization.split(" ")[1]
    
    try:
        client = get_supabase()
        # Verify user via Supabase auth API
        user_response = client.auth.get_user(token)

        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user = user_response.user
        user_id = str(user.id)
        email = user.email or ""

        # Fetch profile for role
        role = "user"
        full_name = ""
        try:
            admin_client = get_supabase_admin()
            profile_res = admin_client.table("profiles").select("*").eq("id", user_id).execute()
            if profile_res.data and len(profile_res.data) > 0:
                role = profile_res.data[0].get("role", "user")
                full_name = profile_res.data[0].get("full_name", "")
            else:
                user_meta = user.user_metadata or {}
                role = user_meta.get("role", "user")
                full_name = user_meta.get("full_name", email.split("@")[0])
                admin_client.table("profiles").upsert({
                    "id": user_id,
                    "email": email,
                    "full_name": full_name,
                    "role": role
                }).execute()
        except Exception as e:
            logger.warning(f"Error fetching/ensuring profile: {e}")

        return {
            "id": user_id,
            "email": email,
            "full_name": full_name,
            "role": role,
            "token": token
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication exception: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def require_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Ensures the authenticated user has 'admin' role."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Admin privilege required."
        )
    return current_user
