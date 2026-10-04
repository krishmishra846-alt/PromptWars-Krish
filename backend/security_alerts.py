import time
import asyncio
from typing import Dict, List
import logging
from config import settings

logger = logging.getLogger("argus.alerts")

# In-memory attack tracker
_FAILED_LOGINS: Dict[str, List[float]] = {}
_ALERT_COOLDOWNS: Dict[str, float] = {}

async def dispatch_telegram_alert(title: str, details: str, severity: str = "HIGH"):
    """Dispatches real-time security attack & billing threshold alert to the Admin Telegram channel."""
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("Telegram Bot Token not configured; skipping security alert delivery.")
        return

    try:
        from routers.telegram_bot import broadcast_telegram_message
        icon = "🚨" if severity == "CRITICAL" else "⚠️"
        alert_msg = (
            f"{icon} <b>SECURITY INCIDENT ALERT: {title}</b>\n\n"
            f"<b>Severity:</b> {severity}\n"
            f"<b>Details:</b> {details}\n"
            f"<b>Timestamp:</b> {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}\n"
            f"<b>Action:</b> Automated defensive countermeasures activated."
        )
        await broadcast_telegram_message(alert_msg)
        logger.info("Security alert dispatched successfully: %s", title)
    except Exception as e:
        logger.error("Failed to dispatch security alert to Telegram: %s", str(e))

def record_failed_login(ip: str, identifier: str):
    """
    Checklist Item #9: Tracks failed login attempts and triggers automated
    alerts upon detecting brute-force attacks.
    """
    now = time.time()
    if ip not in _FAILED_LOGINS:
        _FAILED_LOGINS[ip] = []
    
    # Keep last 5 minutes
    _FAILED_LOGINS[ip] = [t for t in _FAILED_LOGINS[ip] if t > now - 300]
    _FAILED_LOGINS[ip].append(now)

    if len(_FAILED_LOGINS[ip]) >= 5:
        # Check cooldown (alert at most once every 3 minutes per IP)
        last_alert = _ALERT_COOLDOWNS.get(ip, 0)
        if now - last_alert > 180:
            _ALERT_COOLDOWNS[ip] = now
            asyncio.create_task(dispatch_telegram_alert(
                title="Brute Force Attack Detected",
                details=f"IP <code>{ip}</code> reached 5+ failed login attempts targeting identifier '<code>{identifier}</code>'. Rate limiting and defensive delays enforced.",
                severity="HIGH"
            ))

def record_honeypot_trap(ip: str, form_name: str):
    """
    Checklist Item #3 & #9: Triggers alert when a headless scraper fills a hidden honeypot.
    """
    now = time.time()
    last_alert = _ALERT_COOLDOWNS.get(f"hp_{ip}", 0)
    if now - last_alert > 180:
        _ALERT_COOLDOWNS[f"hp_{ip}"] = now
        asyncio.create_task(dispatch_telegram_alert(
            title="Automated Bot Trapped",
            details=f"Automated bot submission detected from IP <code>{ip}</code> on form '<code>{form_name}</code>' via honeypot trap. Request dropped.",
            severity="MEDIUM"
        ))

def record_rate_limit_spike(ip: str, endpoint: str):
    """
    Checklist Item #9: Alert when severe rate limit spikes occur (potential DoS).
    """
    now = time.time()
    last_alert = _ALERT_COOLDOWNS.get(f"rl_{ip}", 0)
    if now - last_alert > 300:
        _ALERT_COOLDOWNS[f"rl_{ip}"] = now
        asyncio.create_task(dispatch_telegram_alert(
            title="Volumetric Traffic Spike / Rate Limit Tripped",
            details=f"High request volume from IP <code>{ip}</code> hitting <code>{endpoint}</code>. HTTP 429 throttling active.",
            severity="HIGH"
        ))
