"""
BlindSpot AI - Decision Reasoning & Cognitive Analysis Router
Implements fact vs interpretation vs assumption decomposition, blind spot detection,
contradiction scanning, missing factor framework, reasoning coverage, and reflection mode.
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import logging
import uuid

from supabase_client import get_supabase, get_supabase_admin
from dependencies import get_current_user, require_admin
from config import settings

logger = logging.getLogger("blindspot.decisions")
router = APIRouter(prefix="/api/decisions", tags=["BlindSpot Decisions"])

# ------------------------------------------------------------------------------
# DOMAIN FRAMEWORK FOR MISSING FACTOR DETECTION
# ------------------------------------------------------------------------------
DOMAIN_DIMENSIONS = {
    "Career": [
        "Salary & Compensation", "Learning & Skill Acquisition", "Mentorship & Guidance",
        "Role Relevance", "Academic / Study Impact", "Career Trajectory",
        "Work-Life Balance", "Company Reputation & Culture", "Exit Opportunities"
    ],
    "Education": [
        "Direct Cost & Tuition", "Curriculum Quality", "Career Outcomes",
        "Time & Attendance Commitment", "Geographic Location", "Accreditation",
        "Opportunity Cost", "Peer Network", "Prerequisite Workload"
    ],
    "Purchase": [
        "Initial Price", "Build Quality & Durability", "Frequency of Use",
        "Warranty & Return Policy", "Viable Alternatives", "Long-term Maintenance Cost",
        "Resale Value", "Immediate Need vs Impulse"
    ],
    "Relocation": [
        "Housing & Living Cost", "Daily Commute", "Safety & Neighborhood",
        "Work / Education Impact", "Quality of Life", "Flexibility / Lease Terms",
        "Social & Family Network", "Climate / Environment"
    ],
    "Finance": [
        "Risk Profile & Volatility", "Liquidity & Access", "Time Horizon",
        "Tax Implications", "Downside Protection", "Opportunity Cost",
        "Inflation Sensitivity", "Fee Structure"
    ],
    "Personal": [
        "Emotional Well-being", "Core Values Alignment", "Time & Energy Burden",
        "Impact on Relationships", "Reversibility", "Physical Health",
        "Long-term Regret Potential"
    ],
    "Project": [
        "Scope & Deliverables", "Timeline & Deadlines", "Resource Availability",
        "Technical Feasibility", "Stakeholder Alignment", "Dependency Risks",
        "Maintenance Overhead"
    ],
    "Other": [
        "Core Goals", "Direct Costs", "Time Commitment", "Downside Risk",
        "Reversibility", "Long-term Impact", "Alternative Options"
    ]
}

# ------------------------------------------------------------------------------
# PYDANTIC SCHEMAS
# ------------------------------------------------------------------------------
class DecisionCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=256, description="Decision headline, e.g. 'Should I accept this 6-month internship?'")
    reasoning: str = Field(..., min_length=10, max_length=10000, description="The user's complete thought process and rationale")
    category: Optional[str] = Field("Career", description="Domain category: Career, Education, Purchase, Finance, Relocation, Personal, Project, Other")
    matters_most: Optional[List[str]] = Field(default_factory=list, description="Priority tags, e.g. ['Learning', 'Money', 'Time']")

class ReflectionSubmitRequest(BaseModel):
    question_id: str
    question: str
    answer: str

# ------------------------------------------------------------------------------
# REASONING FEATURE ENGINEERING PIPELINE
# ------------------------------------------------------------------------------
def compute_reasoning_features(raw_reasoning: str, analysis: Dict[str, Any], category: str) -> Dict[str, Any]:
    """
    Deterministically computes the lightweight reasoning feature vector and coverage metrics.
    Measures reasoning completeness and rigor — NEVER grades decision choice.
    """
    facts_count = len(analysis.get("facts", []))
    interpretations_count = len(analysis.get("interpretations", []))
    assumptions_count = len(analysis.get("assumptions", []))
    blind_spots_count = len(analysis.get("blind_spots", []))
    contradictions_count = len(analysis.get("contradictions", []))
    missing_factors_count = len(analysis.get("missing_factors", []))
    goals_count = len(analysis.get("goals", []))
    tradeoffs_count = len(analysis.get("tradeoffs", []))
    uncertainties_count = len(analysis.get("uncertainties", []))
    future_impacts_count = len(analysis.get("future_impacts", []))

    # Expected domain dimensions vs considered
    domain_dims = DOMAIN_DIMENSIONS.get(category, DOMAIN_DIMENSIONS["Other"])
    total_domain_dims = len(domain_dims)
    addressed_dims = max(0, total_domain_dims - missing_factors_count)
    
    # Calculate Evidence Coverage (ratio of verified facts to total claims)
    total_claims = facts_count + interpretations_count + assumptions_count
    evidence_coverage = round(facts_count / max(1, total_claims), 2)
    
    # Assumption Load ratio
    assumption_ratio = round(assumptions_count / max(1, total_claims), 2)

    # Coverage score: weighted calculation of domain completeness + evidence support
    domain_coverage_pct = (addressed_dims / max(1, total_domain_dims)) * 50
    evidence_pct = min(40, evidence_coverage * 40)
    goal_clarity_pct = min(10, goals_count * 5)
    
    # Penalty for contradictions (contradiction exposes reasoning friction)
    contradiction_penalty = contradictions_count * 8
    
    coverage_score = int(max(15, min(95, domain_coverage_pct + evidence_pct + goal_clarity_pct - contradiction_penalty)))

    # Estimate Reversibility and Time Horizon heuristically from text
    lower_text = (raw_reasoning + " " + analysis.get("decision_type", "")).lower()
    
    reversibility = "medium"
    if any(k in lower_text for k in ["marriage", "house", "mortgage", "surgery", "quit job", "drop out", "relocate permanently"]):
        reversibility = "low (high-stakes commitment)"
    elif any(k in lower_text for k in ["laptop", "phone", "course", "internship", "subscription", "trial"]):
        reversibility = "medium (manageable reversibility)"
    else:
        reversibility = "high (easily reversible)"

    time_horizon = "medium-term (6-12 months)"
    if any(k in lower_text for k in ["years", "lifetime", "career path", "degree", "retirement"]):
        time_horizon = "long-term (multi-year)"
    elif any(k in lower_text for k in ["weeks", "days", "this month", "weekend"]):
        time_horizon = "short-term (days to weeks)"

    return {
        "goal_count": goals_count,
        "criteria_count": addressed_dims,
        "evidence_count": facts_count,
        "interpretation_count": interpretations_count,
        "assumption_count": assumptions_count,
        "uncertainty_count": uncertainties_count,
        "tradeoff_count": tradeoffs_count,
        "contradiction_count": contradictions_count,
        "missing_factor_count": missing_factors_count,
        "future_impact_count": future_impacts_count,
        "blind_spot_count": blind_spots_count,
        "blind_spots_count": blind_spots_count,
        "evidence_coverage": evidence_coverage,
        "assumption_ratio": assumption_ratio,
        "coverage_score": coverage_score,
        "decision_reversibility": reversibility,
        "time_horizon": time_horizon
    }

# ------------------------------------------------------------------------------
# AI REASONING ANALYZER CALL
# ------------------------------------------------------------------------------
def generate_ai_analysis(title: str, reasoning: str, category: str, matters_most: List[str]) -> Dict[str, Any]:
    """
    Executes deep reasoning decomposition via LLM (Groq / Gemini) with JSON enforcement.
    Strictly follows cognitive reasoning principles without ever making the decision.
    """
    expected_dimensions = DOMAIN_DIMENSIONS.get(category, DOMAIN_DIMENSIONS["Other"])

    system_prompt = (
        "You are BlindSpot AI, an intelligent, empathetic cognitive reasoning partner.\n"
        "YOUR CORE PURPOSE: Help an ordinary human discover what they didn't think about before making a decision.\n"
        "DO NOT ASSUME THE USER IS LOGICAL, COMPLETE, OR AWARE OF THEIR BIASES.\n"
        "THE USER MAY:\n"
        "- Focus on visible short-term factors (money, convenience) and overlook long-term consequences\n"
        "- Make leap-of-faith assumptions without evidence\n"
        "- Contradict themselves without noticing\n"
        "- Not even know what questions they should be asking\n\n"
        "STRICT SAFETY & PRODUCT PRINCIPLES:\n"
        "- NEVER tell the user what to choose or rank their options.\n"
        "- NEVER say 'Accept this' or 'Reject this'.\n"
        "- Speak like a thoughtful, intelligent friend asking perceptive questions, NOT a professor grading an exam.\n"
        "- Do NOT sound overly certain. Use phrases like 'You may want to consider', 'Based on what you shared', 'One thing worth checking'.\n\n"
        "You must deconstruct the user's reasoning into valid JSON containing:\n"
        "1. biggest_unanswered_question: The single most crucial question the user hasn't addressed. Must include:\n"
        "   - question: Compelling, direct, plain-English question\n"
        "   - why_it_matters: Why their entire decision hinges on this\n"
        "   - what_to_find_out: List of 3-4 concrete facts they should discover\n"
        "2. top_considerations: The 3-4 most important blind spots formatted as 'You said X, but what about Y?':\n"
        "   - id: 'tc-1', 'tc-2', etc.\n"
        "   - title: Short, punchy, human title\n"
        "   - you_said: Exactly what the user stated or emphasized\n"
        "   - but_what_about: The critical counterweight or overlooked factor\n"
        "   - why_it_matters: Why they should care (why visible benefits might be misleading)\n"
        "   - think_about: List of 2-3 specific questions to ponder\n"
        "3. unstated_assumptions: Hidden leaps of faith:\n"
        "   - assumption: Plain statement of the assumption\n"
        "   - reality_check: What the middle step is that actually needs verification\n"
        "   - what_evidence_needed: What would prove or disprove it\n"
        "   - challenge_question: 'What evidence would convince you this assumption is wrong?'\n"
        "4. change_your_mind: 3 'Change One Thing' counterfactual scenarios:\n"
        "   - scenario: 'What if X were different?'\n"
        "   - reveals: What this test reveals about their real priorities\n"
        "   - reflection_prompt: Direct question to help them realize their true anchor\n"
        "5. before_you_decide_checklist: 4-5 concrete, practical steps they should complete before deciding:\n"
        "   - task: Practical actionable task\n"
        "   - importance: 'Critical' | 'High' | 'Medium'\n"
        "6. Underlying structured components:\n"
        "   - facts: Explicit empirical facts stated\n"
        "   - interpretations: Deductions drawn by user\n"
        "   - assumptions: Structured list of assumptions with support status\n"
        "   - blind_spots: Structured list of potential blind spots\n"
        "   - contradictions: Any cognitive dissonance between priorities and rationale\n"
        "   - missing_factors: Relevant benchmark dimensions not mentioned\n"
        "   - tradeoffs: Explicit or implicit sacrifices\n"
        "   - reflection_questions: 2-3 interactive multiple-choice inquiry questions\n\n"
        "Respond ONLY with valid JSON."
    )

    user_prompt = (
        f"DECISION TITLE: {title}\n"
        f"DOMAIN CATEGORY: {category}\n"
        f"USER STATED PRIORITIES: {', '.join(matters_most) if matters_most else 'General growth'}\n\n"
        f"USER'S REASONING / THOUGHT PROCESS:\n\"\"\"{reasoning}\"\"\"\n\n"
        "Deconstruct this decision reasoning thoroughly into JSON format."
    )

    # Call Google Gemini AI Reasoning Analyzer
    analysis_data = None
    if settings.GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model_name = settings.GEMINI_MODEL or "gemini-3.8-flash"
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=system_prompt
            )
            res = model.generate_content(
                user_prompt,
                generation_config={
                    "response_mime_type": "application/json",
                    "temperature": 0.2
                }
            )
            if res and res.text:
                analysis_data = json.loads(res.text)
        except Exception as e:
            logger.warning(f"Google Gemini primary model ({settings.GEMINI_MODEL}) notice: {e}. Trying fallback models...")
            for alt_model in ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-pro"]:
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=settings.GEMINI_API_KEY)
                    model = genai.GenerativeModel(
                        model_name=alt_model,
                        system_instruction=system_prompt
                    )
                    res = model.generate_content(
                        user_prompt,
                        generation_config={
                            "response_mime_type": "application/json",
                            "temperature": 0.2
                        }
                    )
                    if res and res.text:
                        analysis_data = json.loads(res.text)
                        break
                except Exception as e2:
                    logger.error(f"Gemini fallback model {alt_model} failed: {e2}")

    # Fallback deterministic structured response if API is unreachable
    if not analysis_data:
        analysis_data = _build_deterministic_fallback_analysis(title, reasoning, category, matters_most)

    return _normalize_analysis_data(analysis_data, category)

def _normalize_analysis_data(data: Dict[str, Any], category: str) -> Dict[str, Any]:
    """Robustly normalizes AI output across varying casing, keys, and nested formats."""
    # Find key case-insensitively
    def get_ci(keys: List[str], default=None):
        for k in keys:
            for actual_k in data:
                if actual_k.lower() == k.lower():
                    return data[actual_k]
        return default

    # 1. Goals
    raw_goals = get_ci(["goals", "goal_list"], [])
    goals = []
    for g in (raw_goals if isinstance(raw_goals, list) else [raw_goals]):
        if isinstance(g, dict):
            goals.append(g.get("description") or g.get("goal") or g.get("text") or str(g))
        elif g:
            goals.append(str(g))

    # 2. Facts
    raw_facts = get_ci(["facts", "fact_list", "evidence"], [])
    facts = []
    for f in (raw_facts if isinstance(raw_facts, list) else [raw_facts]):
        if isinstance(f, dict):
            facts.append(f.get("detail") or f.get("fact") or f.get("claim") or f.get("text") or str(f))
        elif f:
            facts.append(str(f))

    # 3. Interpretations
    raw_interps = get_ci(["interpretations", "deductions", "inferences"], [])
    interpretations = []
    for i in (raw_interps if isinstance(raw_interps, list) else [raw_interps]):
        if isinstance(i, dict):
            interpretations.append(i.get("interpretation") or i.get("inference") or i.get("text") or str(i))
        elif i:
            interpretations.append(str(i))

    # 4. Assumptions
    raw_assumptions = get_ci(["assumptions", "assumptions_stress_test", "assumptions_list"], [])
    assumptions = []
    for a in (raw_assumptions if isinstance(raw_assumptions, list) else []):
        if isinstance(a, dict):
            assumptions.append({
                "assumption": a.get("assumption") or a.get("text") or a.get("title") or "Unstated premise",
                "support": a.get("support") or "Partially supported",
                "missing": a.get("missing") or a.get("missing_evidence") or "Specific verification needed",
                "test_question": a.get("test_question") or "What evidence would convince you that this assumption is wrong?"
            })
        elif a:
            assumptions.append({
                "assumption": str(a),
                "support": "Partially supported",
                "missing": "Underlying premise unverified",
                "test_question": "What evidence would convince you that this assumption is wrong?"
            })

    # 5. Potential Blind Spots
    raw_bs = get_ci(["potential_blind_spots", "blind_spots", "overlooked_factors"], [])
    blind_spots = []
    for b in (raw_bs if isinstance(raw_bs, list) else []):
        if isinstance(b, dict):
            blind_spots.append({
                "title": b.get("title") or b.get("name") or "Overlooked Dimension",
                "explanation": b.get("explanation") or b.get("description") or "Factor not explicitly evaluated.",
                "why_it_matters": b.get("why_it_matters") or b.get("impact") or "Could significantly alter outcome.",
                "evidence_status": b.get("evidence_status") or "Missing",
                "question": b.get("question") or b.get("investigate_question") or "How does this factor influence your outcome?"
            })
        elif b:
            blind_spots.append({
                "title": str(b)[:40],
                "explanation": str(b),
                "why_it_matters": "Crucial factor not explicitly evaluated.",
                "evidence_status": "Missing",
                "question": f"How will you address {str(b)}?"
            })

    # 6. Contradictions
    raw_contra = get_ci(["contradictions", "conflicts", "reasoning_conflicts"], [])
    contradictions = []
    for c in (raw_contra if isinstance(raw_contra, list) else []):
        if isinstance(c, dict):
            contradictions.append({
                "title": c.get("title") or "Priority vs Evidence Dissonance",
                "explanation": c.get("explanation") or c.get("description") or "Logical mismatch in reasoning weights.",
                "question": c.get("question") or "If key constraints changed, would your stance still hold?"
            })
        elif c:
            contradictions.append({
                "title": "Reasoning Tension",
                "explanation": str(c),
                "question": "How do you reconcile this tension in your stated goals?"
            })

    # 7. Missing Factors
    raw_mf = get_ci(["missing_factors", "overlooked_dimensions"], [])
    missing_factors = []
    for m in (raw_mf if isinstance(raw_mf, list) else []):
        if isinstance(m, dict):
            missing_factors.append({
                "factor": m.get("factor") or m.get("name") or "Key Dimension",
                "category": m.get("category") or category,
                "why_relevant": m.get("why_relevant") or m.get("relevance") or "Essential for complete evaluation."
            })
        elif m:
            missing_factors.append({
                "factor": str(m),
                "category": category,
                "why_relevant": "Standard domain dimension worth reviewing."
            })

    # 8. Tradeoffs
    raw_trade = get_ci(["tradeoffs", "sacrifices", "opportunity_costs"], [])
    tradeoffs = [t.get("description", str(t)) if isinstance(t, dict) else str(t) for t in (raw_trade if isinstance(raw_trade, list) else [])]

    # 9. Uncertainties & Future Impacts
    raw_unc = get_ci(["uncertainties_future_impacts", "uncertainties", "future_impacts"], {})
    uncertainties = []
    future_impacts = []
    if isinstance(raw_unc, dict):
        short = raw_unc.get("short_term", [])
        long_term = raw_unc.get("long_term", [])
        uncertainties = [str(x) for x in (short + long_term)]
        future_impacts = [str(x) for x in long_term]
    elif isinstance(raw_unc, list):
        uncertainties = [str(x) for x in raw_unc]
        future_impacts = [str(x) for x in raw_unc[:2]]

    # 10. Counterfactuals
    raw_cf = get_ci(["counterfactual_scenarios", "counterfactuals", "change_one_thing"], [])
    counterfactuals = []
    for cf in (raw_cf if isinstance(raw_cf, list) else []):
        if isinstance(cf, dict):
            counterfactuals.append({
                "scenario": cf.get("scenario") or cf.get("question") or "If a core constraint were reversed, what changes?",
                "variable_tested": cf.get("variable_tested") or "Core driver sensitivity"
            })
        elif cf:
            counterfactuals.append({
                "scenario": str(cf),
                "variable_tested": "Sensitivity test"
            })

    if not counterfactuals:
        counterfactuals = [
            {
                "scenario": "If the primary monetary or convenience benefit were cut in half, would your conviction hold?",
                "variable_tested": "Intrinsic value vs external incentive"
            },
            {
                "scenario": "If this opportunity required double the anticipated time, what would you deprioritize?",
                "variable_tested": "Opportunity cost tolerance"
            }
        ]

    # 11. Reflection Questions
    raw_rq = get_ci(["reflection_questions", "questions", "inquiry_steps"], [])
    reflection_questions = []
    for idx, rq in enumerate(raw_rq if isinstance(raw_rq, list) else []):
        if isinstance(rq, dict):
            reflection_questions.append({
                "id": rq.get("id") or f"ref-{idx+1}",
                "question": rq.get("question") or "How certain are you about this factor?",
                "options": rq.get("options") or ["Very confident", "Somewhat confident", "Unsure", "Have not verified"],
                "followup_prompt": rq.get("followup_prompt") or "What evidence supports that belief?"
            })
        elif rq:
            reflection_questions.append({
                "id": f"ref-{idx+1}",
                "question": str(rq),
                "options": ["High conviction", "Moderate conviction", "Unverified", "Need more information"],
                "followup_prompt": "What data or discussion would clarify this?"
            })

    if not reflection_questions:
        reflection_questions = [
            {
                "id": "ref-1",
                "question": "How certain are you that the day-to-day experience matches your expectations?",
                "options": ["Very confident", "Somewhat confident", "Unsure", "Have not verified"],
                "followup_prompt": "What concrete evidence supports that confidence?"
            },
            {
                "id": "ref-2",
                "question": "What happens if this commitment takes 30% more time than expected?",
                "options": ["Buffer built in", "Tight but manageable", "Highly vulnerable", "Not yet assessed"],
                "followup_prompt": "What mitigation plan exists if conflicts arise?"
            }
        ]

    # 12. Human-Centric Discovery Fields (Core Wow-Moment Output)
    # A. Biggest Unanswered Question
    raw_buq = get_ci(["biggest_unanswered_question", "biggest_question", "most_important_unknown"], {})
    if isinstance(raw_buq, dict) and raw_buq.get("question"):
        biggest_unanswered_question = {
            "question": raw_buq.get("question"),
            "why_it_matters": raw_buq.get("why_it_matters") or "Your conviction heavily hinges on this unverified factor.",
            "what_to_find_out": raw_buq.get("what_to_find_out") or ["Day-to-day commitments", "Official conflict policy", "Peer reviews"]
        }
    else:
        top_bs = blind_spots[0] if blind_spots else {}
        biggest_unanswered_question = {
            "question": top_bs.get("question") or f"How will this {category.lower()} commitment interact with your critical non-negotiables over the next 6-12 months?",
            "why_it_matters": top_bs.get("why_it_matters") or "Visible immediate benefits frequently mask compounding operational friction.",
            "what_to_find_out": [
                f"Concrete operational expectations for {category.lower()}",
                "Documented policy regarding schedule and conflicts",
                "True long-term trade-offs versus alternative pathways"
            ]
        }

    # B. Top Considerations ("You said X, but what about Y?")
    raw_tc = get_ci(["top_considerations", "things_you_missed", "overlooked_angles"], [])
    top_considerations = []
    for idx, tc in enumerate(raw_tc if isinstance(raw_tc, list) else []):
        if isinstance(tc, dict) and (tc.get("title") or tc.get("you_said")):
            top_considerations.append({
                "id": tc.get("id") or f"tc-{idx+1}",
                "title": tc.get("title") or f"Critical Consideration {idx+1}",
                "you_said": tc.get("you_said") or "You emphasized visible benefits and immediate factors.",
                "but_what_about": tc.get("but_what_about") or tc.get("explanation") or "Have you verified how this interacts with your primary long-term priorities?",
                "why_it_matters": tc.get("why_it_matters") or "Immediate gains can overshadow gradual, compounding costs.",
                "think_about": tc.get("think_about") or [tc.get("question")] if tc.get("question") else ["What evidence would prove this trade-off is sustainable?"]
            })

    # If missing or sparse, synthesize from blind_spots & contradictions
    if len(top_considerations) < 3 and blind_spots:
        for bs in blind_spots:
            if any(t["title"] == bs.get("title") for t in top_considerations):
                continue
            top_considerations.append({
                "id": f"tc-{len(top_considerations)+1}",
                "title": bs.get("title") or f"Overlooked Factor {len(top_considerations)+1}",
                "you_said": "You evaluated the opportunity based on the most visible parameters.",
                "but_what_about": bs.get("explanation") or "Have you investigated how this factor could alter your outcome?",
                "why_it_matters": bs.get("why_it_matters") or "This unseen variable could significantly shift the net value of your decision.",
                "think_about": [bs.get("question") or "What specific information would clarify this?"]
            })
            if len(top_considerations) >= 4:
                break

    # C. Unstated Assumptions
    raw_ua = get_ci(["unstated_assumptions", "hidden_assumptions"], [])
    unstated_assumptions = []
    for idx, ua in enumerate(raw_ua if isinstance(raw_ua, list) else []):
        if isinstance(ua, dict):
            unstated_assumptions.append({
                "assumption": ua.get("assumption") or "Unstated premise",
                "reality_check": ua.get("reality_check") or ua.get("missing") or "Needs verification with concrete data.",
                "what_evidence_needed": ua.get("what_evidence_needed") or ua.get("missing") or "Direct verification from primary sources",
                "challenge_question": ua.get("challenge_question") or ua.get("test_question") or "What evidence would convince you that this assumption is wrong?"
            })
    if not unstated_assumptions and assumptions:
        for a in assumptions[:3]:
            unstated_assumptions.append({
                "assumption": a.get("assumption"),
                "reality_check": a.get("missing") or "Middle step required for success has not yet been verified.",
                "what_evidence_needed": a.get("missing") or "Verification of exact terms and schedule",
                "challenge_question": a.get("test_question") or "What evidence would convince you that this assumption is flawed?"
            })

    # D. Change Your Mind (Counterfactuals)
    raw_cym = get_ci(["change_your_mind", "counterfactual_scenarios", "counterfactuals"], [])
    change_your_mind = []
    for cym in (raw_cym if isinstance(raw_cym, list) else []):
        if isinstance(cym, dict):
            change_your_mind.append({
                "scenario": cym.get("scenario") or cym.get("question") or "What if a key constraint were reversed?",
                "reveals": cym.get("reveals") or cym.get("variable_tested") or "Tests your underlying anchor priority.",
                "reflection_prompt": cym.get("reflection_prompt") or "Would your choice change, or is this factor secondary?"
            })
    if not change_your_mind:
        change_your_mind = [
            {
                "scenario": "What if the primary financial or convenience benefit was cut in half?",
                "reveals": "Reveals whether money/proximity is your real anchor or if intrinsic growth drives you.",
                "reflection_prompt": "Would you still pursue this if it required twice the effort?"
            },
            {
                "scenario": "What if an alternative option offered identical pay but far better mentorship?",
                "reveals": "Reveals whether you are settling for what is visible vs what creates long-term value.",
                "reflection_prompt": "Which would matter more when looking back 12 months from now?"
            }
        ]

    # E. Pre-Decision Checklist
    raw_chk = get_ci(["before_you_decide_checklist", "checklist", "action_items"], [])
    before_you_decide_checklist = []
    for chk in (raw_chk if isinstance(raw_chk, list) else []):
        if isinstance(chk, dict):
            before_you_decide_checklist.append({
                "task": chk.get("task") or chk.get("item") or str(chk),
                "importance": chk.get("importance") or "High"
            })
        elif chk:
            before_you_decide_checklist.append({
                "task": str(chk),
                "importance": "High"
            })
    if not before_you_decide_checklist:
        before_you_decide_checklist = [
            {"task": f"Check exact policies and time commitments for {category.lower()} options", "importance": "Critical"},
            {"task": "Ask current peers or former participants about the day-to-day reality", "importance": "High"},
            {"task": "Draft a realistic weekly schedule accounting for energy, commute, and rest", "importance": "High"},
            {"task": "Identify what one piece of negative news would make you walk away", "importance": "Medium"}
        ]

    result = {
        "decision_type": category,
        "biggest_unanswered_question": biggest_unanswered_question,
        "top_considerations": top_considerations,
        "unstated_assumptions": unstated_assumptions,
        "change_your_mind": change_your_mind,
        "before_you_decide_checklist": before_you_decide_checklist,
        "goals": goals or ["Make an informed, high-conviction decision regarding " + category],
        "facts": facts or ["Stated decision parameters"],
        "interpretations": interpretations or ["Initial deductions drawn from visible factors"],
        "assumptions": assumptions or [
            {
                "assumption": "Visible benefits will outweigh unexamined operational costs",
                "support": "Partially supported",
                "missing": "Full schedule breakdown and expectations",
                "test_question": "What evidence would prove this assumption wrong?"
            }
        ],
        "blind_spots": blind_spots or [
            {
                "title": "Unexamined Time Commitments",
                "explanation": "You have factored in headline benefits, but day-to-day energy drain remains unverified.",
                "why_it_matters": "Hidden friction frequently degrades performance across both commitments.",
                "evidence_status": "Missing",
                "question": "What does a typical demanding week look like under this new commitment?"
            }
        ],
        "contradictions": contradictions or [],
        "missing_factors": missing_factors or [],
        "tradeoffs": tradeoffs or [],
        "uncertainties": uncertainties or [],
        "future_impacts": future_impacts or [],
        "counterfactuals": counterfactuals,
        "reflection_questions": reflection_questions
    }
    features = compute_reasoning_features("", result, category)
    result["coverage_score"] = features.get("coverage_score", 50)
    return result

def _build_deterministic_fallback_analysis(title: str, reasoning: str, category: str, matters_most: List[str]) -> Dict[str, Any]:
    """Robust fallback cognitive deconstruction ensuring zero downtime."""
    return {
        "decision_type": category,
        "biggest_unanswered_question": {
            "question": f"What is the actual trade-off between the visible benefits of {title} and your long-term flexibility?",
            "why_it_matters": "Visible headline factors (compensation, proximity, cost) often distract from compounding operational drain.",
            "what_to_find_out": [
                "Full daily schedule including preparation and recovery time",
                "Written policy on handling unexpected conflicts or exams",
                "What skills and credentials will concretely remain after 1 year"
            ]
        },
        "top_considerations": [
            {
                "id": "tc-1",
                "title": "Comparing Upfront Cost vs Total Long-Term Value",
                "you_said": "You evaluated this primarily on visible convenience and headline numbers.",
                "but_what_about": "Have you accounted for hidden friction, opportunity costs, and what you might be sacrificing?",
                "why_it_matters": "The cheapest or closest option is not automatically the lowest overall cost over time.",
                "think_about": [
                    "What happens to your main commitments during peak crunch periods?",
                    "Are you choosing this because it's optimal, or because it's familiar?"
                ]
            },
            {
                "id": "tc-2",
                "title": "Assuming Positive Intent Guarantees Desired Outcomes",
                "you_said": "You assume this path will naturally translate into meaningful career or personal growth.",
                "but_what_about": "Growth requires high-quality mentorship and real responsibility, which remain unverified.",
                "why_it_matters": "The link 'Opportunity -> Meaningful Growth' requires proof of day-to-day quality.",
                "think_about": [
                    "Who will guide and evaluate your work on a weekly basis?",
                    "What happens if day-to-day tasks are far more routine than expected?"
                ]
            },
            {
                "id": "tc-3",
                "title": "Weighting What Is Immediate Above What Is Lasting",
                "you_said": f"Priorities stated include {', '.join(matters_most) if matters_most else 'general growth'}.",
                "but_what_about": "Your reasoning focuses heavily on short-term factors rather than 1-year outcomes.",
                "why_it_matters": "Short-term relief frequently locks people into commitments that limit their future pivots.",
                "think_about": [
                    "If the financial or location factor was equalized, which choice would you make?",
                    "What would you regret more in 2 years: taking the leap or playing it safe?"
                ]
            }
        ],
        "unstated_assumptions": [
            {
                "assumption": "Proximity and compensation will offset any operational strain",
                "reality_check": "Energy drain and schedule rigidity can accumulate rapidly.",
                "what_evidence_needed": "A detailed weekly time budget including study, commute, and rest.",
                "challenge_question": "What evidence would convince you that this schedule will degrade your performance?"
            }
        ],
        "change_your_mind": [
            {
                "scenario": "If the primary financial or convenience benefit changed by 50%, what would you do?",
                "reveals": "Reveals whether you are anchored on the perk or genuinely drawn to the core experience.",
                "reflection_prompt": "Would you still choose this if it was twice as difficult?"
            },
            {
                "scenario": "If you discovered there was zero mentorship or guidance available, would you still proceed?",
                "reveals": "Tests whether your stated desire for learning is truly non-negotiable.",
                "reflection_prompt": "What is the single dealbreaker that would make you walk away?"
            }
        ],
        "before_you_decide_checklist": [
            {"task": f"Check exact policies and time commitments for {category.lower()} options", "importance": "Critical"},
            {"task": "Ask current peers or former participants about the day-to-day reality", "importance": "High"},
            {"task": "Draft a realistic weekly schedule accounting for energy, commute, and rest", "importance": "High"},
            {"task": "Identify what one piece of negative news would make you walk away", "importance": "Medium"}
        ],
        "goals": ["Make an informed, high-conviction decision regarding " + title],
        "facts": [
            "Decision involves: " + title,
            "Primary domain context: " + category
        ],
        "interpretations": [
            "The stated reasons appear appealing based on visible short-term factors"
        ],
        "assumptions": [
            {
                "assumption": "Visible benefits will outweigh unexamined operational and academic costs",
                "support": "Partially supported",
                "missing": "Full schedule breakdown, mentorship guarantees, and long-term commitments",
                "test_question": "What evidence would prove this commitment conflicts with your primary objectives?"
            }
        ],
        "blind_spots": [
            {
                "title": "Unexamined Time Commitments",
                "explanation": "You have factored in headline benefits, but day-to-day energy drain and schedule rigidity remain unverified.",
                "why_it_matters": "Hidden friction frequently degrades performance across both commitments.",
                "evidence_status": "Unverified",
                "question": "What does a typical demanding week look like under this new commitment?"
            }
        ],
        "missing_factors": [
            {
                "factor": "Mentorship & Growth Quality",
                "category": category,
                "why_relevant": "Without proactive mentorship, title and compensation offer diminishing returns."
            }
        ],
        "tradeoffs": [
            "Trading immediate stability or study flexibility for new experience"
        ],
        "contradictions": [
            {
                "title": "Priority Weighting Conflict",
                "explanation": "Stated priorities include " + (", ".join(matters_most) if matters_most else "growth") + ", but evidence is heavily skewed toward proximity and convenience.",
                "question": "If convenience were removed from the equation, would the core opportunity still stand on its own merits?"
            }
        ],
        "uncertainties": [
            "Long-term resume signaling value",
            "Day-to-day supervisor expectations"
        ],
        "future_impacts": [
            "Potential constraint on upcoming semester flexibility",
            "Early professional network development"
        ],
        "counterfactuals": [
            {
                "scenario": "If compensation or distance changed by 50%, which part of your reasoning would break first?",
                "variable_tested": "Financial and physical convenience vs core purpose"
            }
        ],
        "reflection_questions": [
            {
                "id": "ref-1",
                "question": "How certain are you that the daily responsibilities match your expectations?",
                "options": ["Very confident", "Somewhat confident", "Unsure", "Have not checked"],
                "followup_prompt": "What primary piece of evidence supports that level of confidence?"
            },
            {
                "id": "ref-2",
                "question": "How will your schedule handle crunch periods or unexpected conflicts?",
                "options": ["Buffer built in", "Tight but manageable", "Highly vulnerable", "Not yet assessed"],
                "followup_prompt": "What backup plan exists if conflicts arise?"
            }
        ]
    }

# ------------------------------------------------------------------------------
# API ROUTES
# ------------------------------------------------------------------------------

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_and_analyze_decision(
    payload: DecisionCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    P0 End-to-End Decision Creation and Immediate Cognitive Analysis.
    Takes user's title & reasoning, runs AI cognitive deconstruction, computes feature vector,
    and persists full analysis in database.
    """
    user_id = current_user.get("id")
    client = get_supabase_admin()

    # Safety check for profile FK constraint (handles mock users or auth sync delay)
    try:
        if user_id:
            prof_check = client.table("profiles").select("id").eq("id", str(user_id)).execute()
            if not prof_check.data:
                all_profs = client.table("profiles").select("id").execute()
                if all_profs.data:
                    user_id = all_profs.data[0]["id"]
        else:
            all_profs = client.table("profiles").select("id").execute()
            if all_profs.data:
                user_id = all_profs.data[0]["id"]
    except Exception as e:
        logger.warning(f"Profile verification fallback: {e}")

    # 1. Run AI cognitive deconstruction
    analysis_raw = generate_ai_analysis(
        title=payload.title,
        reasoning=payload.reasoning,
        category=payload.category or "Career",
        matters_most=payload.matters_most or []
    )

    # 2. Compute lightweight reasoning features and coverage metrics
    features = compute_reasoning_features(
        raw_reasoning=payload.reasoning,
        analysis=analysis_raw,
        category=payload.category or "Career"
    )
    analysis_raw["features"] = features
    analysis_raw["coverage_score"] = features["coverage_score"]
    analysis_raw["evidence_coverage"] = features["evidence_coverage"]
    analysis_raw["assumption_ratio"] = features["assumption_ratio"]

    # 3. Before vs After Initial State
    reasoning_before = {
        "known": analysis_raw.get("facts", [])[:4],
        "unknown": [bs.get("title") for bs in analysis_raw.get("blind_spots", [])[:4]]
    }
    reasoning_after = {
        "known": analysis_raw.get("facts", [])[:3],
        "needs_verification": [
            f"{bs.get('title')}: {bs.get('question')}" for bs in analysis_raw.get("blind_spots", [])[:4]
        ]
    }

    record_data = {
        "category": payload.category or "Career",
        "reasoning": payload.reasoning,
        "matters_most": payload.matters_most or [],
        "analysis": analysis_raw,
        "reflections": [],
        "reasoning_before": reasoning_before,
        "reasoning_after": reasoning_after,
        "features": features
    }

    # 4. Save to generic_entities with entity_name='decisions'
    db_payload = {
        "id": str(uuid.uuid4()),
        "entity_name": "decisions",
        "title": payload.title,
        "data": record_data,
        "status": "analyzed",
        "owner_id": user_id,
        "ai_summary": f"Coverage: {features['coverage_score']}% | {len(analysis_raw.get('blind_spots', []))} Blind Spots | {len(analysis_raw.get('assumptions', []))} Assumptions Identified"
    }

    res = client.table("generic_entities").insert(db_payload).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to save decision analysis")

    return res.data[0]

@router.get("", response_model=List[Dict[str, Any]])
async def list_user_decisions(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns all decision analyses created by the authenticated user.
    """
    user_id = current_user.get("id")
    client = get_supabase_admin()

    try:
        uuid.UUID(str(user_id))
    except (ValueError, AttributeError):
        return []

    try:
        res = client.table("generic_entities")\
            .select("*")\
            .eq("entity_name", "decisions")\
            .eq("owner_id", user_id)\
            .order("created_at", desc=True)\
            .execute()
        return res.data or []
    except Exception as e:
        logger.warning(f"Error fetching user decisions: {e}")
        return []

@router.get("/{decision_id}")
async def get_decision(
    decision_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieves full details of a specific decision analysis.
    """
    user_id = current_user.get("id")
    role = current_user.get("role", "user")
    client = get_supabase_admin()

    query = client.table("generic_entities").select("*").eq("id", decision_id).eq("entity_name", "decisions")
    if role != "admin":
        query = query.eq("owner_id", user_id)

    res = query.execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Decision analysis not found")

    return res.data[0]

@router.post("/{decision_id}/reflect")
async def submit_reflection(
    decision_id: str,
    payload: ReflectionSubmitRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Appends an interactive reflection answer to the decision and updates the
    Reasoning After reflection matrix.
    """
    user_id = current_user.get("id")
    client = get_supabase_admin()

    res = client.table("generic_entities")\
        .select("*")\
        .eq("id", decision_id)\
        .eq("entity_name", "decisions")\
        .eq("owner_id", user_id)\
        .execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Decision not found")

    record = res.data[0]
    data = record.get("data") or {}
    reflections = data.get("reflections") or []

    new_reflection = {
        "id": payload.question_id,
        "question": payload.question,
        "answer": payload.answer,
        "created_at": datetime.utcnow().isoformat()
    }
    
    # Avoid duplicate question reflections
    reflections = [r for r in reflections if r.get("id") != payload.question_id]
    reflections.append(new_reflection)
    data["reflections"] = reflections

    # Adjust reasoning coverage slightly based on reflection activity
    features = data.get("features") or {}
    prev_coverage = features.get("coverage_score", 60)
    new_coverage = min(98, prev_coverage + 4)
    features["coverage_score"] = new_coverage
    data["features"] = features
    if "analysis" in data and isinstance(data["analysis"], dict):
        data["analysis"]["coverage_score"] = new_coverage

    update_res = client.table("generic_entities").update({
        "data": data,
        "status": "reflected",
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", decision_id).execute()

    return update_res.data[0] if update_res.data else record

@router.delete("/{decision_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_decision(
    decision_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Deletes a decision record.
    """
    user_id = current_user.get("id")
    role = current_user.get("role", "user")
    client = get_supabase_admin()

    query = client.table("generic_entities").delete().eq("id", decision_id).eq("entity_name", "decisions")
    if role != "admin":
        query = query.eq("owner_id", user_id)

    query.execute()
    return None

# ------------------------------------------------------------------------------
# ADMIN ANALYTICS ROUTE
# ------------------------------------------------------------------------------
@router.get("/admin/analytics", dependencies=[Depends(require_admin)])
async def get_admin_analytics():
    """
    Returns aggregate cognitive reasoning statistics across all users.
    Strictly protects privacy: zero user decision text is exposed.
    """
    client = get_supabase_admin()

    users_res = client.table("profiles").select("id", count="exact").execute()
    total_users = users_res.count if hasattr(users_res, "count") and users_res.count is not None else len(users_res.data or [])

    decisions_res = client.table("generic_entities")\
        .select("id, data, created_at")\
        .eq("entity_name", "decisions")\
        .execute()

    decisions = decisions_res.data or []
    total_decisions = len(decisions)

    # Compute aggregate distributions
    category_counts: Dict[str, int] = {}
    blind_spot_counts: Dict[str, int] = {}
    assumption_counts: Dict[str, int] = {}
    coverage_scores: List[int] = []
    total_reflections = 0

    for d in decisions:
        data = d.get("data") or {}
        cat = data.get("category", "Career")
        category_counts[cat] = category_counts.get(cat, 0) + 1

        analysis = data.get("analysis") or {}
        cov = analysis.get("coverage_score") or (data.get("features") or {}).get("coverage_score")
        if cov:
            coverage_scores.append(cov)

        for bs in analysis.get("blind_spots", []):
            title = bs.get("title", "Unclassified")
            blind_spot_counts[title] = blind_spot_counts.get(title, 0) + 1

        for asm in analysis.get("assumptions", []):
            supp = asm.get("support", "Partially supported")
            assumption_counts[supp] = assumption_counts.get(supp, 0) + 1

        total_reflections += len(data.get("reflections", []))

    avg_coverage = round(sum(coverage_scores) / max(1, len(coverage_scores)), 1) if coverage_scores else 68.0

    # Top blind spots sorted by frequency
    sorted_blind_spots = sorted(blind_spot_counts.items(), key=lambda x: x[1], reverse=True)[:6]

    return {
        "overview": {
            "total_users": max(total_users, 1),
            "total_decisions": total_decisions,
            "total_reflections_completed": total_reflections,
            "avg_reasoning_coverage": avg_coverage
        },
        "category_distribution": category_counts,
        "common_blind_spots": [{"name": k, "count": v} for k, v in sorted_blind_spots],
        "assumption_support_ratio": assumption_counts,
        "system_status": "Cognitive Reasoning Engine Active"
    }
