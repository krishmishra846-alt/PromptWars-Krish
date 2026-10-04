from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import Dict, Any
from dependencies import get_current_user
from supabase_client import get_supabase_admin
from config import settings
import os
import uuid
import re
import logging

logger = logging.getLogger("argus.uploads")
router = APIRouter(prefix="/api/upload", tags=["Uploads & Files"])

# Secure local storage directory
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Security Constants
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB maximum
ALLOWED_EXTENSIONS = {
    ".pdf", ".docx", ".doc", ".txt", ".csv",
    ".log", ".json", ".png", ".jpg", ".jpeg", ".webp"
}
DISALLOWED_PATTERNS = re.compile(r"(\.exe|\.bat|\.cmd|\.sh|\.php|\.py|\.pl|\.cgi|\.js|\.vbs|\.msi)$", re.IGNORECASE)

@router.post("", response_model=Dict[str, Any])
async def upload_file(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Secure Universal File Attachment Handler:
    - Enforces maximum file size limit (10MB) to mitigate DoS / disk exhaustion.
    - Sanitizes filenames against directory traversal vulnerabilities.
    - Strictly whitelists permitted business and evidence document extensions.
    - Uploads to Supabase Storage with graceful fallback to secure local persistence.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename cannot be empty")

    # Extract & validate extension
    original_name = os.path.basename(file.filename)
    ext = os.path.splitext(original_name)[1].lower()

    if DISALLOWED_PATTERNS.search(original_name) or ext not in ALLOWED_EXTENSIONS:
        logger.warning("Blocked dangerous file upload attempt: %s by user %s", original_name, current_user.get("id"))
        raise HTTPException(
            status_code=400,
            detail=f"Security Policy: File extension '{ext}' is not permitted. Permitted formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Read bytes and verify size
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum permissible size of {MAX_FILE_SIZE_BYTES // (1024*1024)}MB."
        )

    # Sanitize name to prevent path traversal
    safe_clean_stem = re.sub(r"[^a-zA-Z0-9_\-]", "_", os.path.splitext(original_name)[0])[:40]
    safe_name = f"{uuid.uuid4().hex[:12]}_{safe_clean_stem}{ext}"

    # 1. Attempt Supabase Storage upload
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        try:
            admin_client = get_supabase_admin()
            admin_client.storage.from_("uploads").upload(
                path=safe_name,
                file=file_bytes,
                file_options={"content-type": file.content_type or "application/octet-stream", "upsert": "true"}
            )
            public_url = admin_client.storage.from_("uploads").get_public_url(safe_name)
            logger.info("Uploaded %s to Supabase Storage for user %s", safe_name, current_user.get("id"))
            return {
                "filename": original_name,
                "url": public_url,
                "storage": "supabase",
                "size_bytes": len(file_bytes)
            }
        except Exception as e:
            logger.warning("Supabase storage upload fallback triggered: %s", str(e))

    # 2. Secure Local file persistence fallback
    local_path = os.path.join(UPLOAD_DIR, safe_name)
    with open(local_path, "wb") as f:
        f.write(file_bytes)

    local_url = f"/uploads/{safe_name}"
    logger.info("Persisted %s locally for user %s", safe_name, current_user.get("id"))
    return {
        "filename": original_name,
        "url": local_url,
        "storage": "local",
        "size_bytes": len(file_bytes)
    }
