from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from config import settings
from supabase_client import get_supabase_admin
from dependencies import get_optional_user
import httpx
import asyncio
import logging
import json
import os

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/telegram", tags=["Telegram Bot"])

# In-memory storage for active chat IDs (persisted locally so bot remembers who started it)
CHATS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "telegram_chats.json")

def get_env_file_path() -> str:
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")

def get_bot_token() -> str:
    token = (settings.TELEGRAM_BOT_TOKEN or "").strip()
    if not token or token == "None":
        token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    if not token or token == "None":
        env_path = get_env_file_path()
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("TELEGRAM_BOT_TOKEN="):
                            token = line.split("=", 1)[1].strip()
                            break
            except Exception:
                pass
    return token

def is_valid_chat_id(val: str) -> bool:
    if not val:
        return False
    v = str(val).strip()
    if v.startswith("-"):
        v = v[1:]
    return v.isdigit()

def load_registered_chats() -> List[str]:
    chats = []
    # Check settings / env
    raw_env = (settings.TELEGRAM_CHAT_ID or os.getenv("TELEGRAM_CHAT_ID") or "").strip()
    if not raw_env:
        env_path = get_env_file_path()
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("TELEGRAM_CHAT_ID="):
                            raw_env = line.split("=", 1)[1].strip()
                            break
            except Exception:
                pass
    if is_valid_chat_id(raw_env) and raw_env not in chats:
        chats.append(raw_env)

    if os.path.exists(CHATS_FILE):
        try:
            with open(CHATS_FILE, "r") as f:
                saved = json.load(f)
                if isinstance(saved, list):
                    for c in saved:
                        s_c = str(c).strip()
                        if is_valid_chat_id(s_c) and s_c not in chats:
                            chats.append(s_c)
        except Exception:
            pass
    return chats

def register_chat(chat_id: str):
    str_id = str(chat_id).strip()
    if not is_valid_chat_id(str_id):
        return
    chats = load_registered_chats()
    if str_id not in chats:
        chats.append(str_id)
        try:
            with open(CHATS_FILE, "w") as f:
                json.dump(chats, f)
            logger.info(f"Registered new Telegram chat ID: {str_id}")
        except Exception as e:
            logger.warning(f"Could not save telegram chat ID: {e}")

class TestMessageRequest(BaseModel):
    chat_id: Optional[str] = None
    message: Optional[str] = None

class QueryConfirmationRequest(BaseModel):
    title: str = Field(..., description="Query title or question")
    domain: str = Field("General", description="Domain or schema name")
    user_name: Optional[str] = "Operator"
    details: Optional[str] = None
    status: Optional[str] = "active"
    ai_briefing: Optional[str] = None

def is_telegram_configured() -> bool:
    return bool(get_bot_token())

async def send_telegram_raw(text: str, chat_id: str) -> bool:
    token = get_bot_token()
    if not token or not chat_id:
        return False
    
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                return True
            else:
                logger.warning(f"Telegram API responded with {res.status_code}: {res.text}")
                return False
    except Exception as e:
        logger.warning(f"Failed to send Telegram message: {e}")
        return False

async def broadcast_telegram_notification(html_message: str, specific_chat_id: Optional[str] = None):
    """Sends a notification to the specified chat or all registered chat IDs."""
    if not is_telegram_configured():
        return False
    
    chats = [specific_chat_id] if specific_chat_id else load_registered_chats()
    if not chats:
        logger.info("Telegram notification skipped: No chat IDs registered yet (start bot on Telegram with /start)")
        return False
    
    success = False
    for cid in chats:
        if cid:
            ok = await send_telegram_raw(html_message, cid)
            if ok:
                success = True
    return success

async def notify_new_record_created(
    entity_name: str,
    title: str,
    record_data: Dict[str, Any],
    status_val: str,
    user_name: str,
    file_urls: List[str] = None,
    ai_summary: str = ""
):
    """Formats and dispatches a rich confirmation message to Telegram when a new record/query is created."""
    if not is_telegram_configured():
        return
    
    domain_icons = {
        "incidents": "🚨",
        "patients": "🩺",
        "items": "📦"
    }
    icon = domain_icons.get(entity_name.lower(), "⚡")
    
    status_emoji = {
        "critical": "🔴",
        "pending": "🟡",
        "resolved": "🟢",
        "active": "🔵"
    }.get(status_val.lower(), "⚪")

    lines = [
        f"<b>{icon} ARGUS NEXUS :: NEW ENTRY CONFIRMATION</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━━",
        f"📌 <b>Title:</b> {title}",
        f"📂 <b>Domain:</b> <code>{entity_name.upper()}</code>",
        f"🚦 <b>Status:</b> {status_emoji} {status_val.upper()}",
        f"👤 <b>Operator:</b> {user_name or 'System User'}",
    ]

    # Key attributes from dynamic data
    if record_data and isinstance(record_data, dict):
        preview_fields = []
        for k, v in list(record_data.items())[:3]:
            label = k.replace('_', ' ').capitalize()
            preview_fields.append(f"• <b>{label}:</b> {v}")
        if preview_fields:
            lines.append("📝 <b>Attributes:</b>\n" + "\n".join(preview_fields))

    if file_urls and len(file_urls) > 0:
        lines.append(f"📎 <b>Attachments:</b> {len(file_urls)} document(s) uploaded")

    if ai_summary:
        clean_summary = ai_summary.replace('#', '').strip()[:240]
        lines.append(f"\n🤖 <b>AI Executive Briefing:</b>\n<i>{clean_summary}...</i>")

    lines.append("\n🔗 <a href='http://localhost:5173'>Open Operational Dashboard</a>")

    msg = "\n".join(lines)
    asyncio.create_task(broadcast_telegram_notification(msg))

async def notify_chatbot_query(
    query_text: str,
    domain: str,
    user_name: str,
    ai_response: str = ""
):
    """Dispatches a confirmation to Telegram when a user runs an AI knowledge query."""
    if not is_telegram_configured():
        return

    preview_ans = (ai_response[:220] + "...") if len(ai_response) > 220 else ai_response

    msg = (
        f"<b>💬 ARGUS NEXUS :: AI QUERY DISPATCH</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"❓ <b>Query:</b> \"{query_text}\"\n"
        f"🌐 <b>Scope:</b> <code>{domain.upper()}</code>\n"
        f"👤 <b>Queried By:</b> {user_name or 'Operator'}\n\n"
        f"🤖 <b>AI Response Preview:</b>\n"
        f"<i>{preview_ans}</i>\n\n"
        f"🔗 <a href='http://localhost:5173'>View Full Session on Dashboard</a>"
    )
    asyncio.create_task(broadcast_telegram_notification(msg))

# --- API Endpoints for Frontend Management & Verification ---

@router.get("/status")
async def get_telegram_status():
    """Returns Telegram bot configuration and connectivity status."""
    token = get_bot_token()
    if not token:
        return {
            "configured": False,
            "message": "TELEGRAM_BOT_TOKEN is not set in backend/.env",
            "bot_username": None,
            "registered_chats_count": len(load_registered_chats())
        }
    
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(f"https://api.telegram.org/bot{token}/getMe")
            if res.status_code == 200:
                data = res.json()
                bot_user = data.get("result", {})
                return {
                    "configured": True,
                    "bot_name": bot_user.get("first_name"),
                    "bot_username": bot_user.get("username"),
                    "registered_chats": load_registered_chats(),
                    "default_chat_id": settings.TELEGRAM_CHAT_ID or None
                }
            else:
                return {
                    "configured": False,
                    "error": f"Invalid bot token or Telegram API error: {res.text}",
                    "bot_username": None
                }
    except Exception as e:
        return {
            "configured": False,
            "error": str(e),
            "bot_username": None
        }

@router.post("/test")
async def send_test_message(payload: TestMessageRequest):
    """Sends a verification ping to Telegram."""
    if not is_telegram_configured():
        raise HTTPException(
            status_code=400,
            detail="TELEGRAM_BOT_TOKEN is not configured in backend/.env yet. Please create a bot with @BotFather and add your token."
        )

    target_chat = payload.chat_id or settings.TELEGRAM_CHAT_ID
    if not target_chat:
        chats = load_registered_chats()
        if chats:
            target_chat = chats[0]
        else:
            raise HTTPException(
                status_code=400,
                detail="No recipient Chat ID configured. Open your Telegram bot, click /start, or provide a chat_id in the request."
            )

    msg = payload.message or (
        "<b>🟢 ARGUS NEXUS TELEGRAM GATEWAY :: TEST SUCCESSFUL</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Your Telegram Bot is fully connected and ready to receive real-time operational confirmations and query updates!"
    )

    success = await send_telegram_raw(msg, target_chat)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send message to Telegram. Please verify your Bot Token and Chat ID.")

    return {
        "status": "success",
        "chat_id": target_chat,
        "message": "Test notification delivered to Telegram successfully!"
    }

@router.post("/confirm-query")
async def trigger_query_confirmation(payload: QueryConfirmationRequest):
    """Manually or programmatically triggers a confirmation message to Telegram."""
    await notify_chatbot_query(
        query_text=payload.title,
        domain=payload.domain,
        user_name=payload.user_name or "Operator",
        ai_response=payload.ai_briefing or payload.details or "Query received and processed successfully."
    )
    return {"status": "queued"}

async def handle_telegram_command(text: str, chat_id: str, user_first_name: str):
    """
    Telegram is configured strictly for operational mentions (entry confirmations, 
    query alerts, and OTP codes). Interactive chatting is disabled per operator preference.
    """
    register_chat(chat_id)
    cmd = text.strip()
    
    # 1. /start
    if cmd.startswith("/start"):
        reply = (
            f"👋 <b>Welcome, {user_first_name}!</b>\n\n"
            f"<b>Argus Nexus Operational Gateway Active</b>\n"
            f"✅ <b>Registered Chat ID:</b> <code>{chat_id}</code>\n\n"
            f"📌 <i>This channel is configured strictly to deliver:</i>\n"
            f"• <b>New Operational Entry Confirmations</b>\n"
            f"• <b>AI Query Dispatch Summaries</b>\n"
            f"• <b>Security OTP Verification Codes</b>\n\n"
            f"💬 <i>For full interactive chat, use the AI Assistant on your dashboard.</i>\n"
            f"🔗 <a href='http://localhost:5173'>Open Dashboard</a>"
        )
        await send_telegram_raw(reply, chat_id)
        return

    # 2. Any other text - notify that Telegram is strictly for mentions & OTP
    reply = (
        "ℹ️ <b>Argus Nexus Notification Channel</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "This bot is configured strictly for <b>Record Confirmations</b>, <b>Query Dispatch Alerts</b>, and <b>OTP Verification</b>.\n\n"
        "💬 <i>To chat with Argus AI, please use the on-dashboard AI Assistant.</i>\n"
        "🔗 <a href='http://localhost:5173'>Open Dashboard</a>"
    )
    await send_telegram_raw(reply, chat_id)

async def run_telegram_polling():
    """Background task to poll Telegram updates non-stop without blocking FastAPI."""
    logger.info("Telegram Bot Long-Polling service worker initialized.")
    offset = 0

    while True:
        try:
            current_token = get_bot_token()
            if not current_token:
                await asyncio.sleep(5)
                continue
            
            poll_url = f"https://api.telegram.org/bot{current_token}/getUpdates"

            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.get(f"{poll_url}?offset={offset}&timeout=20")
                if res.status_code == 200:
                    data = res.json()
                    for update in data.get("result", []):
                        offset = max(offset, update["update_id"] + 1)
                        message = update.get("message")
                        if message and "text" in message:
                            text = message["text"]
                            chat_id = str(message["chat"]["id"])
                            user_name = message.get("from", {}).get("first_name", "Operator")
                            logger.info(f"Telegram Bot received: '{text}' from {user_name} ({chat_id})")
                            asyncio.create_task(handle_telegram_command(text, chat_id, user_name))
                elif res.status_code == 401:
                    logger.warning("Telegram Bot Token is invalid (401 Unauthorized). Retrying in 30s...")
                    await asyncio.sleep(30)
                else:
                    await asyncio.sleep(3)
        except httpx.TimeoutException:
            # Normal long-polling timeout, continue immediately
            continue
        except Exception as e:
            logger.warning(f"Telegram polling exception: {e}")
            await asyncio.sleep(5)
