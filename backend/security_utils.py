import re
import html
from typing import Any, Dict, List, Union, Optional
from config import settings
import logging

logger = logging.getLogger("argus.security")

# Regex to detect potential script injections or active payloads
XSS_PATTERNS = re.compile(
    r"(<script.*?>.*?</script>|<iframe.*?>.*?</iframe>|javascript:|vbscript:|onload=|onerror=|onclick=)",
    re.IGNORECASE | re.DOTALL
)

SLUG_PATTERN = re.compile(r"^[a-z0-9_\-]+$")

def sanitize_text(value: Optional[str] = "") -> str:
    """Sanitizes text against XSS, null-byte injections, and controls."""
    if not value or not isinstance(value, str):
        return ""
    # Strip null bytes
    cleaned = value.replace("\x00", "")
    # Remove obvious malicious executable markup tags
    cleaned = XSS_PATTERNS.sub("", cleaned)
    # Strip leading/trailing whitespace
    return cleaned.strip()

def sanitize_json_payload(data: Union[Dict[str, Any], List[Any], str, int, float, bool, None]) -> Any:
    """Recursively traverses JSON dictionaries and arrays, sanitizing all nested string values."""
    if isinstance(data, dict):
        return {str(k): sanitize_json_payload(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_json_payload(item) for item in data]
    elif isinstance(data, str):
        return sanitize_text(data)
    return data

def validate_entity_slug(slug: str) -> bool:
    """Validates that entity names adhere strictly to safe alphanumeric slugs."""
    if not slug or len(slug) > 64:
        return False
    return bool(SLUG_PATTERN.match(slug.strip().lower()))

def get_safe_error_detail(e: Exception, default_msg: str = "An unexpected server error occurred.") -> str:
    """
    Prevents verbose production error leakage (OWASP Rule #12).
    In production mode, returns a sanitized public message while logging the full exception securely.
    """
    logger.error("Internal exception caught: %s", str(e), exc_info=True)
    if settings.ENVIRONMENT.lower() == "production":
        return default_msg
    return f"{default_msg} ({str(e)})"

# Standard aliases
sanitize_string = sanitize_text
is_safe_identifier = validate_entity_slug
