from supabase import create_client, Client
from config import settings
import logging

logger = logging.getLogger("uvicorn.error")

supabase: Client | None = None
supabase_admin: Client | None = None

if settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    except Exception as e:
        logger.warning(f"Could not initialize anonymous Supabase client: {e}")

if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase_admin = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    except Exception as e:
        logger.warning(f"Could not initialize service-role Supabase client: {e}")
elif settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY:
    # Fallback to anon client if service role key not provided yet
    supabase_admin = supabase

def get_supabase() -> Client:
    if not supabase:
        raise ValueError("Supabase is not configured. Please supply SUPABASE_URL and SUPABASE_ANON_KEY.")
    return supabase

def get_supabase_admin() -> Client:
    if not supabase_admin:
        if supabase:
            return supabase
        raise ValueError("Supabase admin is not configured. Please supply SUPABASE_URL and keys.")
    return supabase_admin
