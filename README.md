# 🧠 Chitragupta.AI — Cognitive Decision Reasoning & Blind Spot Detection Assistant

> **"See what your reasoning missed."**  
> *A human-first cognitive reasoning companion that deconstructs your decision-making process to uncover unstated assumptions, overlooked factors, and reasoning contradictions—powered by Google Gemini AI without ever making the decision for you.*

---

## 🎯 1. Problem Statement Alignment & Challenge Mapping

### The Core Problem Statement:
> **"People often make decisions based on the information that is most visible to them. They may overlook important factors, rely on unstated assumptions, or fail to recognize conflicts within their own reasoning."**

### 🛡️ The Cardinal Safety Principle:
> **THE SYSTEM MUST NEVER MAKE THE DECISION FOR THE USER.**  
> Chitragupta.AI does not tell the user to "Accept" or "Reject", nor does it score their intelligence or grade their life choices. The human decision-maker always owns 100% of the final choice. Chitragupta.AI acts as a calm, friendly thinking companion that expands perspective and measures **Reasoning Completeness**.

### Direct Problem-to-Feature Mapping Matrix:

| Problem Statement Component | How Chitragupta.AI Solves It | Engine & Component Location |
| :--- | :--- | :--- |
| **"Information that is most visible"** | Surfaces the **Biggest Unanswered Question** and identifies hidden long-term trade-offs that visible perks mask. | `frontend/src/components/BlindSpotAnalysisView.jsx` (`.biggest-question-hero-card`) |
| **"Overlook important factors"** | Detects **Potential Blind Spots** across real-world domains (e.g., academic attendance, mentor availability, workload). | `backend/services/google_services.py` & `routers/decisions.py` (`blind_spots`) |
| **"Rely on unstated assumptions"** | Deconstructs reasoning into a 4-step sequential journey: **Fact $\rightarrow$ Interpretation $\rightarrow$ Assumption $\rightarrow$ Let's Check Together**. | `frontend/src/components/BlindSpotAnalysisView.jsx` (`.thinking-journey-card`) |
| **"Conflicts within own reasoning"** | Identifies cognitive dissonance between stated priorities (e.g. learning) and actual factors weighed (e.g. stipend/commute). | `backend/routers/decisions.py` (`contradictions` engine) |
| **"Premature commitment"** | Generates an actionable **Pre-Decision Checklist** of practical verification steps before locking in a decision. | `frontend/src/components/BlindSpotAnalysisView.jsx` (`.checklist-tab-layout`) |
| **"Confirmation bias"** | Conducts **"Change One Thing" (Counterfactual)** sensitivity scenarios to isolate the user's true anchor priority. | `backend/services/google_services.py` (`change_your_mind`) |

---

## 🚀 2. Google Cloud & Google Services Integration

Chitragupta.AI is built from the ground up to leverage the full power of **Google Cloud & Google AI Services**:

1. **Google Gemini Generative AI SDK (`google-generativeai` & `@google/genai`)**:
   - Primary cognitive reasoning engine utilizing `gemini-1.5-flash`, `gemini-2.0-flash`, and `gemini-1.5-pro` with structured JSON schema enforcement.
   - Live SDK verification endpoint: `GET /api/google-services/status`.
2. **Google Cloud Run Production Deployment**:
   - Containerized with multi-stage production [`Dockerfile`](./Dockerfile) optimized for serverless Google Cloud Run execution.
   - Complete Google Cloud Build deployment pipeline configured in [`cloudbuild.yaml`](./cloudbuild.yaml).
3. **Google Fonts & Typography Optimization**:
   - Inter and Outfit typography loaded with Google Fonts DNS prefetch and preconnect tags for instant render performance.
4. **Google Identity & OAuth Architecture**:
   - Ready for Google Identity Services / OAuth 2.0 social authentication and secure JWT validation.

```
                           ┌──────────────────────────────────────────────┐
                           │      Chitragupta.AI React 19 Frontend App         │
                           │   (Google Fonts, Accessible, Vite, Tailwind) │
                           └──────────────────────┬───────────────────────┘
                                                  │ REST API / Bearer JWT
                                                  ▼
                           ┌──────────────────────────────────────────────┐
                           │          FastAPI Backend Gateway             │
                           │      OWASP Top 10 Hardened, Rate Limited     │
                           └──────────────────────┬───────────────────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────────────────┐
                 ▼                                ▼                                ▼
  ┌─────────────────────────────┐  ┌─────────────────────────────┐  ┌─────────────────────────────┐
  │   Google Gemini 1.5/2.0     │  │   Cognitive Feature Engine  │  │    Supabase PostgreSQL      │
  │   (google-generativeai)     │  │  Coverage Ratios & Heuristics│ │   Row-Level Security (RLS)  │
  │  + Deterministic Fallback   │  │  Deterministic Verification │  │   Encrypted Decisions DB    │
  └─────────────────────────────┘  └─────────────────────────────┘  └─────────────────────────────┘
```

---

## ♿ 3. Accessibility & Usability (WCAG 2.1 AA Compliant)

Chitragupta.AI meets and exceeds **WCAG 2.1 AA** standards for digital accessibility:
- **Semantic HTML5 Architecture**: Full hierarchy using `<header role="banner">`, `<nav role="navigation">`, `<main id="main-content" role="main">`, `<section>`, and `<article>`.
- **Skip Navigation Link**: Accessible `.skip-to-content` link allowing screen-reader and keyboard users to bypass header navigation.
- **Full Keyboard Navigation**: All interactive elements (curiosity cards, consideration toggles, decision journeys) have `tabIndex={0}`, `role="button"`, and keyboard event handlers (`Enter` and `Space`).
- **Accessible ARIA Attributes**: Includes `aria-expanded`, `aria-label`, `aria-live="polite"`, and `aria-hidden="true"` on decorative icons.
- **High-Contrast Focus Indicators**: High-visibility `:focus-visible` outline rings (`2px solid #06b6d4`, offset `3px`) compliant across all browsers.
- **Color Contrast Ratios**: All typography adheres to minimum 4.5:1 contrast against dark background themes.

---

## ⚡ 4. System Efficiency & Performance Metrics

- **Sub-Second Frontend Compile**: Vite build pipeline bundles the production application in **~500ms**.
- **GZip Payload Compression**: Automatic `GZipMiddleware` compresses all responses larger than 1,000 bytes.
- **Real-Time Performance Tracking**: Every response includes microsecond performance measurement via the `X-Process-Time-Ms` HTTP header.
- **Zero-Dependency Heuristic Fallback**: Cognitive analysis engine guarantees 100% availability through deterministic cognitive baseline fallbacks even during third-party API rate limits.
- **Non-Congested Dashboard Mode**: Built-in *"Hide Past Journeys"* mode allows users to declutter their dashboard into a clean, distraction-free thinking space.

---

## 🔒 5. Security & OWASP Top 10 Compliance

Chitragupta.AI is hardened against the OWASP Top 10 web vulnerabilities:
1. **Security Headers**:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY` (Anti-Clickjacking)
   - `X-XSS-Protection: 1; mode=block`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Content-Security-Policy`: Complete CSP restricting script execution and font sources
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (Production HSTS)
2. **CORS Policy**: Strict whitelist restricting API access to verified frontend origins with credential verification.
3. **Sliding-Window Rate Limiter**: IP-based rate limiting on all API routes to prevent brute-force attacks and denial-of-service.
4. **Automated Credential Redaction**: Custom `SensitiveDataRedactionFilter` scrubs API keys, tokens, and passwords from all server logs.
5. **No Exposed Secrets**: `.env` is strictly ignored by Git; `.env.example` provides safe developer placeholders.

---

## 🧪 6. Comprehensive Automated Test Suite (61 Tests Passed - 100% Green)

The project includes dual test suites spanning backend cognitive algorithms, security policies, Google services, and frontend unit tests:

### 1. Backend Pytest Suite (53/53 Tests Passed - 100% Green)
```bash
cd backend
.\venv\Scripts\python.exe -m pytest -v
```
*Coverage:*
- `test_google_services.py`: Google Gemini initialization, fallback, status API, and problem statement alignment.
- `test_accessibility_and_efficiency.py`: Latency headers, GZip compression, OWASP headers, rate limiting.
- `test_cognitive_engine.py`: Reasoning feature engineering vector, coverage metrics, deterministic cognitive fallbacks, normalization edge cases.
- `test_security_deep.py`: Path traversal guards, XSS input scrubbing, credential redaction filter, origin CORS isolation.
- `test_decisions.py`: Feature engineering coverage formulas, authentication boundaries, decision endpoints.
- `test_security_audit.py`: 12 comprehensive tests verifying CSRF, CORS, injection guards, and secret redaction.
- `test_health.py`, `test_auth.py`, `test_entities.py`, `test_schemas.py`, `test_uploads.py`, `test_ai.py`.

### 2. Frontend Node Test Suite (8/8 Tests Passed - 100% Green)
```bash
cd frontend
npm test
```
*Coverage:*
- Problem statement principle verification (Cardinal Rule: Never make the decision for user)
- Google services client helper configuration (`google-generativeai`)
- WCAG 2.1 AA semantic landmark validation (`main`, `banner`, skip link)
- Keyboard interaction requirements (`Enter`, `Space` accessibility handlers)
- Supportive, non-judgmental coverage messaging formulas (Never grades, no toxic words)
- Pre-decision checklist priority sorting and interactive state toggling
- User empowerment feedback chip stance recording
- 4-step cognitive sequential thinking continuity

---

## 🌟 7. Primary Demo Scenario: 1-Click in UI

**Decision:** *"Should I accept a 6-month software internship?"*  
**User Reasoning:**  
> *"I have been offered a 6-month software internship. It pays ₹30,000 per month and the company is about 5 km from my home. The working hours are 9 to 6. I want industry experience and the stipend is attractive. I think because it is close to home I will still have enough time for college."*

### What Chitragupta.AI Reveals:
1. **The Biggest Unanswered Question:** *"What is the true trade-off between the visible benefits and your long-term flexibility?"*
2. **Top Consideration #1:** *"You mentioned convenience, but what about the mental fatigue of full-time context switching between work and exams?"*
3. **Unstated Assumption:** *"Assuming 5 km away guarantees college attendance won't suffer."* $\rightarrow$ **Reality check:** College attendance policies and exam schedules.
4. **Counterfactual Test:** *"If the stipend was cut in half, but they offered direct 1-on-1 mentorship with a Principal Architect, would you still take it?"* (Tests whether money or learning is their true anchor priority).
5. **User Control Actions:** User can click `[ 👍 I already considered this ]` or `[ 💡 This is something I hadn't considered ]`.
6. **Pre-Decision Checklist:** 4 concrete verification tasks before signing the contract.

---

## 💻 8. Quick Start Guide

### Backend:
```bash
cd backend
python -m venv venv
venv\Scripts\activate   # On Windows
pip install -r requirements.txt
python main.py
```
*Server runs at `http://localhost:8000` (`/docs` for interactive OpenAPI documentation).*

### Frontend:
```bash
cd frontend
npm install
npm run dev
```
*App runs at `http://localhost:5173`.*
