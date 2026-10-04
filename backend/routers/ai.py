from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from config import settings
from dependencies import get_current_user, get_optional_user
from supabase_client import get_supabase_admin
import json
import httpx
import os
import io
import pypdf
import docx

router = APIRouter(prefix="/api/ai", tags=["AI & Groq"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")

async def extract_document_text(url: str) -> str:
    """Extracts text content from uploaded files (local disk, Supabase storage, or remote)."""
    if not url:
        return ""
    
    file_bytes = None
    filename = url.split("?")[0].split("/")[-1]
    
    # 1. Check local uploads folder
    local_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(local_path):
        try:
            with open(local_path, "rb") as f:
                file_bytes = f.read()
        except Exception as e:
            print(f"Error reading local attachment {local_path}: {e}")

    # 2. Check remote URL / Supabase Storage via HTTP
    if file_bytes is None and (url.startswith("http://") or url.startswith("https://")):
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    file_bytes = res.content
        except Exception as e:
            print(f"Error fetching remote attachment {url}: {e}")

    if not file_bytes:
        return f"[Document Attached: {filename} (Reference: {url})]"

    ext = os.path.splitext(filename)[1].lower()

    try:
        # PDF Extraction
        if ext == ".pdf":
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            pages = []
            for i, page in enumerate(reader.pages[:10]):
                t = page.extract_text()
                if t:
                    pages.append(f"[Page {i+1}]: {t.strip()}")
            return "\n\n".join(pages) if pages else f"[PDF {filename}: Scanned or image-based document without selectable text]"

        # DOCX Extraction
        elif ext in [".docx", ".doc"]:
            doc = docx.Document(io.BytesIO(file_bytes))
            paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
            for table in doc.tables:
                for row in table.rows:
                    row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                    if row_text:
                        paragraphs.append(row_text)
            return "\n".join(paragraphs) if paragraphs else f"[DOCX {filename}: Empty document]"

        # Text, CSV, Logs, JSON, Markdown, Configs
        elif ext in [".txt", ".csv", ".log", ".json", ".md", ".yaml", ".yml", ".xml", ".tsv", ""]:
            for encoding in ["utf-8", "latin-1", "ascii"]:
                try:
                    return file_bytes.decode(encoding)[:8000]
                except UnicodeDecodeError:
                    continue
            return f"[Text file {filename} could not be decoded]"

        # Images & Scans
        elif ext in [".png", ".jpg", ".jpeg", ".webp", ".svg", ".bmp"]:
            return f"[Image/Scan File: {filename} ({len(file_bytes)} bytes). Visual evidence attached to record.]"

        else:
            try:
                decoded = file_bytes.decode("utf-8", errors="ignore")[:4000]
                return decoded if decoded.strip() else f"[Attached file: {filename} ({ext})]"
            except Exception:
                return f"[Attached file: {filename} ({ext})]"

    except Exception as err:
        return f"[Attachment {filename}: Extraction error: {str(err)}]"

class SummarizeRequest(BaseModel):
    entity_name: Optional[str] = None
    record_id: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    file_urls: Optional[List[str]] = None

class SchemaSuggestRequest(BaseModel):
    problem_statement: str = Field(..., description="Problem description or domain prompt")

import hashlib
import time
import logging

logger = logging.getLogger("argus.ai")

# In-Memory Cache for AI Responses (Deduplication & Sub-Millisecond Speed)
_AI_CACHE: Dict[str, Dict[str, Any]] = {}
AI_CACHE_TTL = 300.0  # 5 minutes

def _get_cached_ai(prompt_key: str) -> Optional[str]:
    entry = _AI_CACHE.get(prompt_key)
    if entry and (time.time() - entry["timestamp"] < AI_CACHE_TTL):
        return entry["response"]
    return None

def _set_cached_ai(prompt_key: str, response: str):
    if len(_AI_CACHE) > 200:
        _AI_CACHE.clear()
    _AI_CACHE[prompt_key] = {"response": response, "timestamp": time.time()}

async def call_gemini_chat(system_prompt: str, user_prompt: str, temperature: float = 0.2) -> Optional[str]:
    """Invokes Google Gemini API if GEMINI_API_KEY is configured."""
    if not settings.GEMINI_API_KEY:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL or "gemini-1.5-flash",
            system_instruction=system_prompt
        )
        response = await model.generate_content_async(
            user_prompt,
            generation_config={"temperature": temperature, "max_output_tokens": 1000}
        )
        if response and response.text:
            return response.text
    except Exception as e:
        logger.warning("Google Gemini invocation notice: %s", str(e))
    return None

async def call_groq_chat(system_prompt: str, user_prompt: str, temperature: float = 0.2) -> str:
    """Helper to query the Groq LLM API with automatic model fallback."""
    if not settings.GROQ_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is not configured in backend .env"
        )
    
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    candidate_models = [settings.GROQ_MODEL, "openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]
    seen = set()
    models_to_try = [m for m in candidate_models if m and not (m in seen or seen.add(m))]

    last_error = None
    for model_name in models_to_try:
        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": temperature,
            "max_tokens": 800
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    json=payload,
                    headers=headers
                )
                if response.status_code == 200:
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    last_error = f"Model {model_name} failed: {response.text}"
        except Exception as e:
            last_error = str(e)
            continue

    raise HTTPException(
        status_code=500,
        detail=f"Groq API Error across fallback models: {last_error}"
    )

async def call_ai_unified(system_prompt: str, user_prompt: str, temperature: float = 0.2) -> Dict[str, str]:
    """
    Unified AI Engine:
    Checks cache first, then checks Google Gemini, then falls back to Groq high-speed inference.
    """
    cache_key = hashlib.sha256(f"{system_prompt}::{user_prompt}".encode()).hexdigest()
    cached = _get_cached_ai(cache_key)
    if cached:
        return {"content": cached, "provider": "cache"}

    # 1. Try Google Gemini if configured
    if settings.GEMINI_API_KEY:
        gemini_res = await call_gemini_chat(system_prompt, user_prompt, temperature)
        if gemini_res:
            _set_cached_ai(cache_key, gemini_res)
            return {"content": gemini_res, "provider": f"Google Gemini ({settings.GEMINI_MODEL})"}

    # 2. Try Groq
    if settings.GROQ_API_KEY:
        groq_res = await call_groq_chat(system_prompt, user_prompt, temperature)
        _set_cached_ai(cache_key, groq_res)
        return {"content": groq_res, "provider": f"Groq ({settings.GROQ_MODEL})"}

    raise HTTPException(
        status_code=500,
        detail="Neither GROQ_API_KEY nor GEMINI_API_KEY is configured in backend environment."
    )

@router.post("/summarize")
async def summarize_record(
    payload: SummarizeRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    """
    Analyzes entity records using Groq LLM to extract key insights,
    a 2-sentence executive summary, and recommended action steps.
    """
    text_parts = []
    if payload.title:
        text_parts.append(f"Title / Headline: {payload.title}")
    if payload.entity_name:
        text_parts.append(f"Domain / Entity Schema: {payload.entity_name}")
    if payload.content:
        text_parts.append(f"Narrative / Notes: {payload.content}")
    if payload.data:
        text_parts.append(f"Structured Data Fields: {json.dumps(payload.data, indent=2)}")

    # Document extraction & deep analysis
    file_urls = payload.file_urls or []
    if payload.record_id:
        try:
            client = get_supabase_admin()
            rec_res = client.table("generic_entities").select("id, owner_id, file_urls").eq("id", payload.record_id).execute()
            if rec_res.data:
                rec_row = rec_res.data[0]
                # Enforce strict user/email data isolation
                if current_user and current_user.get("role") != "admin" and rec_row.get("owner_id") != current_user.get("id"):
                    raise HTTPException(status_code=403, detail="Access denied: Cannot access records of another account")
                if not file_urls and rec_row.get("file_urls"):
                    file_urls = rec_row["file_urls"]
        except HTTPException:
            raise
        except Exception as e:
            print(f"Notice: Failed to fetch record file_urls: {e}")

    if file_urls:
        doc_analyses = []
        for idx, url in enumerate(file_urls):
            doc_text = await extract_document_text(url)
            filename = url.split("?")[0].split("/")[-1]
            doc_analyses.append(f"--- ATTACHED DOCUMENT #{idx+1}: {filename} ---\n{doc_text}")
        if doc_analyses:
            text_parts.append("\n=== ATTACHED DOCUMENTS & EVIDENCE CONTENT ===\n" + "\n\n".join(doc_analyses))

    input_text = "\n".join(text_parts)
    if not input_text.strip():
        raise HTTPException(status_code=400, detail="No content or data provided for summarization")

    system_prompt = (
        "You are Argus Intelligence, an expert enterprise analyst and investigative AI. "
        "Provide a comprehensive, authoritative Executive Briefing for this operational record.\n\n"
        "CRITICAL REQUIREMENT: If any ATTACHED DOCUMENTS/FILES are present in the context, you MUST examine their contents thoroughly, "
        "extract concrete findings, metrics, diagnostics, anomalies, or evidence, and integrate them directly into your briefing.\n\n"
        "Format your output in clean, structured Markdown:\n"
        "### 📋 Executive Briefing\n"
        "[Concise high-level synthesis uniting the record context, priority, and attached findings]\n\n"
        "### 📄 Document Analysis & Extracted Findings\n"
        "[Specific findings, measurements, logs, or diagnostic observations extracted from the attached document(s)]\n\n"
        "### ⚠️ Risk & Operational Impact\n"
        "[Key risks, failure modes, safety/clinical/compliance impacts, and urgency assessment]\n\n"
        "### ⚡ Recommended Immediate Actions\n"
        "[Numbered, actionable steps for the assigned team or operator]"
    )

    ai_result = await call_ai_unified(system_prompt, input_text)
    summary = ai_result["content"]

    # If record_id is supplied, cache summary directly in generic_entities
    if payload.record_id and payload.entity_name:
        try:
            client = get_supabase_admin()
            client.table("generic_entities").update({"ai_summary": summary}).eq("id", payload.record_id).execute()
        except Exception as e:
            logger.warning("Failed to cache AI summary: %s", str(e))

    # Dispatch Telegram confirmation for AI analysis / briefing
    try:
        from .telegram_bot import notify_new_record_created
        user_name = (current_user.get("full_name") or current_user.get("email")) if current_user else "Operator"
        await notify_new_record_created(
            entity_name=payload.entity_name or "Operational",
            title=payload.title or "AI Deep Analysis Briefing",
            record_data=payload.data or {},
            status_val="AI Briefed",
            user_name=user_name,
            file_urls=file_urls,
            ai_summary=summary
        )
    except Exception:
        pass

    return {
        "summary": summary,
        "model_used": ai_result["provider"]
    }

class QueryChatRequest(BaseModel):
    entity_name: str = Field(..., description="Target domain / entity name")
    query: str = Field(..., description="User query or question about the data")
    records_context: Optional[List[Dict[str, Any]]] = Field(default=None, description="Optional current records passed from frontend")
    conversation_history: Optional[List[Dict[str, str]]] = Field(default_factory=list)

@router.post("/query")
async def query_knowledge_base(
    payload: QueryChatRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    """
    Intelligent Data Assistant: Answers natural language questions, extracts statistics,
    and identifies critical patterns from current entity records.
    """
    is_universal = payload.entity_name in ["all", "global", "universal", "", "general"]
    
    if is_universal or payload.records_context is None:
        try:
            client = get_supabase_admin()
            query = client.table("generic_entities").select("id, entity_name, title, status, data, ai_summary, created_at")
            if not is_universal:
                query = query.eq("entity_name", payload.entity_name)
            
            # Strict Email Data Isolation for AI Queries: Every user only queries their own records
            if not current_user or not current_user.get("id"):
                return {
                    "reply": "Operational security policy: Please sign in to query your operational records.",
                    "entity_name": payload.entity_name,
                    "records_analyzed": 0,
                    "model": settings.GROQ_MODEL
                }
            query = query.eq("owner_id", current_user["id"])

            res = query.order("created_at", desc=True).limit(60).execute()
            records = res.data or []
        except Exception as e:
            logger.warning("Error querying user records: %s", str(e))
            records = []
    else:
        records = []

    # Strictly filter records to current user unless admin
    if current_user and current_user.get("role") != "admin":
        records = [r for r in records if r.get("owner_id") == current_user["id"]]

    # Format the data cleanly for the LLM, labeled by domain
    formatted_records = []
    for idx, r in enumerate(records[:45]):
        domain_tag = str(r.get('entity_name', 'general')).upper()
        formatted_records.append(
            f"Record #{idx+1} [Domain: {domain_tag}] [ID: {str(r.get('id', ''))[:8]}]:\n"
            f"  - Title: {r.get('title', '')}\n"
            f"  - Status: {r.get('status', 'active')}\n"
            f"  - Data: {json.dumps(r.get('data', {}))}\n"
            f"  - Previous AI Note: {r.get('ai_summary') or 'None'}\n"
        )
    
    records_block = "\n".join(formatted_records) if formatted_records else "No active records currently registered in database."

    if is_universal:
        system_prompt = (
            "You are the Argus Intelligence Agent with access across all registered system records:\n\n"
            "Live Database Records:\n"
            "------------------\n"
            f"{records_block}\n"
            "------------------\n"
            "Instructions:\n"
            "1. Answer questions accurately based on registered system records.\n"
            "2. When answering, cite relevant record names and fields.\n"
            "3. If asked to summarize, give an executive synthesis highlighting critical items first.\n"
            "4. Be concise, direct, and structured with bold highlights and bullet points."
        )
    else:
        system_prompt = (
            f"You are the Argus Nexus Intelligence Agent for the '{payload.entity_name}' domain.\n"
            "Active Records:\n"
            "------------------\n"
            f"{records_block}\n"
            "------------------\n"
            "Instructions:\n"
            "1. Provide concise, direct, and actionable answers based on the real records above.\n"
            "2. Cite specific Record Titles and Statuses.\n"
            "3. Highlight any urgent, critical, or anomalous entries immediately.\n"
            "4. Format output with clean bullet points and bold headers."
        )

    # Build conversation messages for Groq
    messages = [{"role": "system", "content": system_prompt}]
    for msg in (payload.conversation_history or [])[-6:]:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    messages.append({"role": "user", "content": payload.query})

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    candidate_models = [settings.GROQ_MODEL, "openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]
    seen = set()
    models_to_try = [m for m in candidate_models if m and not (m in seen or seen.add(m))]

    last_error = None
    for model_name in models_to_try:
        req_body = {
            "model": model_name,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 700
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    json=req_body,
                    headers=headers
                )
                if resp.status_code == 200:
                    data = resp.json()
                    reply = data["choices"][0]["message"]["content"]
                    
                    # Dispatch Telegram confirmation in background
                    try:
                        from .telegram_bot import notify_chatbot_query
                        user_name = (current_user.get("full_name") or current_user.get("email")) if current_user else "Operator"
                        await notify_chatbot_query(
                            query_text=payload.query,
                            domain=payload.entity_name or "Universal",
                            user_name=user_name,
                            ai_response=reply
                        )
                    except Exception:
                        pass

                    return {
                        "reply": reply,
                        "entity_name": payload.entity_name,
                        "records_analyzed": len(records),
                        "model": model_name
                    }
                else:
                    last_error = f"Model {model_name} failed: {resp.text}"
        except Exception as e:
            last_error = str(e)
            continue

    raise HTTPException(status_code=500, detail=f"AI query failed across fallback models: {last_error}")

class SchemaSuggestRequest(BaseModel):
    problem_statement: str = Field(..., description="Problem description or domain prompt")

@router.post("/suggest-schema")
async def suggest_schema_from_prompt(
    payload: SchemaSuggestRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    """
    Hackathon Secret Weapon: Given ANY problem statement (medical, logistics, energy, etc.),
    Groq automatically designs the optimal JSON schema ready to save into entity_schemas!
    """
    system_prompt = (
        "You are a database and product architect. Given a problem statement, return a JSON object with:\n"
        "1. 'entity_name' (a short lowercase slug, e.g. 'work_orders', 'vital_signs')\n"
        "2. 'display_name' (human readable title, e.g. 'Work Orders')\n"
        "3. 'description' (one sentence)\n"
        "4. 'icon' (e.g. 'alert-triangle', 'activity', 'clipboard', 'shield', 'package')\n"
        "5. 'fields': list of 3-6 fields, each having: 'name' (snake_case), 'label', 'type' (one of 'text', 'number', 'select', 'textarea'), 'required' (boolean), 'options' (array of strings if type='select', else null), 'summarizable' (boolean).\n"
        "Respond ONLY with valid JSON. No markdown ticks, no preamble."
    )

    ai_res = await call_ai_unified(system_prompt, payload.problem_statement, temperature=0.1)
    raw_response = ai_res["content"]
    cleaned = raw_response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        schema_json = json.loads(cleaned)
        return schema_json
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse LLM schema output as JSON: {raw_response}"
        )


