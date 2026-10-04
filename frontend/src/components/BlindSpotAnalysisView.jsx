import React, { useState } from 'react';
import {
  ArrowLeft, Eye, AlertTriangle, HelpCircle, CheckCircle, ShieldAlert,
  Sparkles, Split, Shuffle, CheckCircle2, AlertCircle, Compass,
  Layers, ExternalLink, RefreshCw, Send, BookmarkCheck, ArrowRight,
  ChevronDown, ChevronUp, CheckSquare, Square, Lightbulb, Zap, Info
} from 'lucide-react';
import api from '../api';

export default function BlindSpotAnalysisView({ decision, onBack, onUpdateDecision }) {
  // Tabs: 'discover' (Default Human View) | 'checklist' | 'deep-analytics' (Under the Hood for Judges)
  const [activeTab, setActiveTab] = useState('discover'); 
  const [checkedItems, setCheckedItems] = useState({});
  const [counterfactualChoice, setCounterfactualChoice] = useState({});
  const [reflectionAnswers, setReflectionAnswers] = useState({});
  const [submittingReflection, setSubmittingReflection] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState({});
  const [expandedCards, setExpandedCards] = useState({});

  if (!decision) return null;

  const data = decision.data || {};
  const analysis = data.analysis || {};
  const features = data.features || analysis.features || {};
  const reflections = data.reflections || [];

  // Human-First Discovery Data
  const biggestQuestion = analysis.biggest_unanswered_question || {
    question: "What is the true trade-off between the visible benefits and your long-term flexibility?",
    why_it_matters: "Visible immediate advantages often mask compounding friction in day-to-day commitments.",
    what_to_find_out: [
      "Exact day-to-day responsibilities and work intensity",
      "Documented policies on unexpected schedule conflicts or exam leave",
      "What concrete skills or exit options remain after 6-12 months"
    ]
  };

  const topConsiderations = analysis.top_considerations && analysis.top_considerations.length > 0 
    ? analysis.top_considerations 
    : (analysis.blind_spots || []).map((bs, i) => ({
        id: `tc-${i + 1}`,
        title: bs.title || `Critical Consideration ${i + 1}`,
        you_said: "You focused heavily on visible advantages and headline numbers.",
        but_what_about: bs.explanation || "Have you verified how this interacts with your primary non-negotiables?",
        why_it_matters: bs.why_it_matters || "Immediate gains can overshadow gradual, compounding costs.",
        think_about: [bs.question || "What specific information would clarify this?"]
      }));

  const unstatedAssumptions = analysis.unstated_assumptions && analysis.unstated_assumptions.length > 0
    ? analysis.unstated_assumptions
    : (analysis.assumptions || []).map(a => ({
        assumption: a.assumption || "Unstated premise",
        reality_check: a.missing || "Needs verification with concrete data.",
        what_evidence_needed: a.missing || "Verification from primary sources",
        challenge_question: a.test_question || "What evidence would convince you this assumption is wrong?"
      }));

  const changeYourMind = analysis.change_your_mind && analysis.change_your_mind.length > 0
    ? analysis.change_your_mind
    : (analysis.counterfactuals || []).map(c => ({
        scenario: c.scenario || "What if a key constraint were reversed?",
        reveals: c.variable_tested || "Tests your underlying anchor priority.",
        reflection_prompt: "Would your choice change, or is this factor secondary?"
      }));

  const checklist = analysis.before_you_decide_checklist && analysis.before_you_decide_checklist.length > 0
    ? analysis.before_you_decide_checklist
    : [
        { task: "Check exact policies and time commitments with all involved parties", importance: "Critical" },
        { task: "Ask someone with direct experience about the day-to-day reality", importance: "High" },
        { task: "Draft a realistic weekly schedule accounting for energy and rest", importance: "High" },
        { task: "Identify what single piece of negative news would make you walk away", importance: "Medium" }
      ];

  // Secondary Engine Data
  const coverageScore = analysis.coverage_score || features.coverage_score || 65;
  const facts = analysis.facts || [];
  const interpretations = analysis.interpretations || [];
  const assumptions = analysis.assumptions || [];
  const blindSpots = analysis.blind_spots || [];
  const contradictions = analysis.contradictions || [];
  const missingFactors = analysis.missing_factors || [];
  const reflectionQuestions = analysis.reflection_questions || [];

  const toggleCheckItem = (idx) => {
    setCheckedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleSelectReflection = async (qId, question, option) => {
    setReflectionAnswers(prev => ({ ...prev, [qId]: option }));
    setSubmittingReflection(true);

    try {
      const res = await api.post(`/api/decisions/${decision.id}/reflect`, {
        question_id: qId,
        question: question,
        answer: option
      });
      if (res.data) {
        onUpdateDecision(res.data);
      }
    } catch (err) {
      console.warn('Could not persist reflection:', err.message);
    } finally {
      setSubmittingReflection(false);
    }
  };

  return (
    <div className="blindspot-analysis-container">
      {/* Top Navigation */}
      <div className="analysis-top-nav">
        <button type="button" onClick={onBack} className="btn-back-link">
          <ArrowLeft size={16} />
          <span>Back to Decisions</span>
        </button>

        <div className="analysis-meta-badges">
          <span className="badge-category">{data.category || 'Career'}</span>
          <span className="badge-timestamp">
            Analyzed {new Date(decision.created_at || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Decision Header */}
      <header className="analysis-header-card human-focus-header">
        <div className="header-eyebrow">
          <Sparkles size={16} className="text-cyan" />
          <span>REASONING DISCOVERY ASSISTANT</span>
        </div>
        <h1 className="analysis-title">{decision.title}</h1>
        
        <div className="user-thought-quote-box">
          <span className="thought-box-label">What you're currently thinking:</span>
          <p className="reasoning-quote">"{data.reasoning}"</p>
        </div>

        {/* View Switcher: Human Discovery vs Engine Under the Hood */}
        <div className="analysis-tab-nav" style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>
          <button
            type="button"
            className={`analysis-tab-btn ${activeTab === 'discover' ? 'active' : ''}`}
            onClick={() => setActiveTab('discover')}
          >
            <Lightbulb size={18} />
            <span>What You Didn't Think About ({topConsiderations.length})</span>
          </button>

          <button
            type="button"
            className={`analysis-tab-btn ${activeTab === 'checklist' ? 'active' : ''}`}
            onClick={() => setActiveTab('checklist')}
          >
            <CheckSquare size={18} />
            <span>Pre-Decision Checklist</span>
          </button>

          <button
            type="button"
            className={`analysis-tab-btn ${activeTab === 'deep-analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('deep-analytics')}
          >
            <Layers size={18} />
            <span>Under the Hood: Deep Engine</span>
          </button>
        </div>
      </header>

      {/* TAB 1: HUMAN DISCOVERY (MAIN PRODUCT EXPERIENCE) */}
      {activeTab === 'discover' && (
        <div className="human-discovery-layout">

          {/* 1. THE BIGGEST UNANSWERED QUESTION (HERO WOW MOMENT) */}
          <section className="biggest-question-hero-card">
            <div className="bq-badge">
              <AlertCircle size={18} className="text-amber" />
              <span>THE BIGGEST UNANSWERED QUESTION</span>
            </div>
            
            <h2 className="bq-title">
              "{biggestQuestion.question}"
            </h2>

            <div className="bq-why-box">
              <span className="bq-why-label">Why your decision hinges on this:</span>
              <p className="bq-why-text">{biggestQuestion.why_it_matters}</p>
            </div>

            {biggestQuestion.what_to_find_out && biggestQuestion.what_to_find_out.length > 0 && (
              <div className="bq-checklist-preview">
                <span className="bq-checklist-label">What you should verify before deciding:</span>
                <ul>
                  {biggestQuestion.what_to_find_out.map((item, i) => (
                    <li key={i}>
                      <ArrowRight size={14} className="text-cyan inline-arrow" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* 2. "YOU SAID X, BUT WHAT ABOUT Y?" (TOP CONSIDERATIONS) */}
          <section className="human-section">
            <div className="section-title-wrap">
              <h3 className="section-heading">
                We found {topConsiderations.length} things worth thinking about
              </h3>
              <p className="section-subheading">
                Let's look at them one at a time. Here is how your initial reasoning looks alongside key real-world factors.
              </p>
            </div>

            <div className="human-consideration-cards">
              {topConsiderations.map((tc, idx) => {
                const colors = ['#f59e0b', '#06b6d4', '#8b5cf6', '#10b981'];
                const cardColor = colors[idx % colors.length];
                const cardId = tc.id || `tc-${idx}`;
                const isExpanded = expandedCards[cardId];
                const currentFeedback = feedbackStatus[cardId];

                return (
                  <article key={cardId} className="consideration-card">
                    <div className="tc-header-row">
                      <span className="tc-number-pill" style={{ background: `${cardColor}20`, color: cardColor, borderColor: `${cardColor}40` }}>
                        #{idx + 1}
                      </span>
                      <h4 className="tc-title">{tc.title}</h4>
                    </div>

                    {/* YOU SAID vs BUT WHAT ABOUT */}
                    <div className="tc-comparison-bubble">
                      <div className="tc-you-said">
                        <span className="bubble-label you-said-label">You mentioned:</span>
                        <p className="bubble-text">"{tc.you_said}"</p>
                      </div>

                      <div className="tc-what-about">
                        <span className="bubble-label what-about-label">Something worth exploring:</span>
                        <p className="bubble-text highlighted-text">{tc.but_what_about}</p>
                      </div>
                    </div>

                    {/* WHY THIS MATTERS */}
                    <div className="tc-why-matters">
                      <span className="why-label">Why this caught our attention:</span>
                      <p className="why-text">{tc.why_it_matters}</p>
                    </div>

                    {/* QUESTIONS TO PONDER (Collapsible or visible) */}
                    {tc.think_about && tc.think_about.length > 0 && (
                      <div className="tc-think-box">
                        <div
                          className="think-box-toggle"
                          onClick={() => setExpandedCards(prev => ({ ...prev, [cardId]: !prev[cardId] }))}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setExpandedCards(prev => ({ ...prev, [cardId]: !prev[cardId] }))}
                          role="button"
                          tabIndex={0}
                          aria-expanded={Boolean(isExpanded)}
                          aria-label="Toggle exploration questions"
                        >
                          <span className="think-label">Questions you may not have asked yourself</span>
                          <span className="text-cyan text-xs flex items-center gap-1 font-medium">
                            {isExpanded ? 'Hide questions' : 'Explore questions'} {isExpanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
                          </span>
                        </div>

                        {isExpanded && (
                          <ul className="think-questions-list">
                            {tc.think_about.map((q, qIdx) => (
                              <li key={qIdx}>{q}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* USER CONTROL & EMPOWERMENT FEEDBACK */}
                    <div className="tc-user-actions-row">
                      <span className="tc-actions-prompt">Does this change how you see the decision?</span>
                      <div className="tc-feedback-buttons">
                        <button
                          type="button"
                          className={`btn-feedback-chip ${currentFeedback === 'already_known' ? 'active-known' : ''}`}
                          onClick={() => setFeedbackStatus(prev => ({ ...prev, [cardId]: 'already_known' }))}
                        >
                          <span>👍 I already considered this</span>
                        </button>

                        <button
                          type="button"
                          className={`btn-feedback-chip ${currentFeedback === 'new_discovery' ? 'active-discovery' : ''}`}
                          onClick={() => setFeedbackStatus(prev => ({ ...prev, [cardId]: 'new_discovery' }))}
                        >
                          <span>💡 This is something I hadn't considered</span>
                        </button>
                      </div>

                      {currentFeedback === 'already_known' && (
                        <p className="feedback-ack-text text-muted">
                          ✓ Perfect! We've noted that you already have this covered.
                        </p>
                      )}

                      {currentFeedback === 'new_discovery' && (
                        <p className="feedback-ack-text text-amber">
                          ✨ Glad this helped! We've highlighted this to check in your Pre-Decision Checklist below.
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* VISUAL JOURNEY: FACT -> INTERPRETATION -> ASSUMPTION */}
          <section className="human-section">
            <div className="section-title-wrap">
              <h3 className="section-heading">🔄 How your thinking connects together</h3>
              <p className="section-subheading">
                Decisions naturally evolve from facts into interpretations, and then into assumptions. Let's trace the journey:
              </p>
            </div>

            <div className="thinking-journey-card">
              <div className="journey-step-item">
                <div className="journey-node-badge node-fact">
                  <span className="journey-step-num">1</span>
                  <span>YOU SAID (FACT)</span>
                </div>
                <div className="journey-node-content">
                  <p className="journey-text">
                    "{facts[0] || (topConsiderations[0] ? topConsiderations[0].you_said : 'The core details you shared')}"
                  </p>
                  <span className="journey-sublabel">✓ That's a verifiable fact you've grounded on.</span>
                </div>
              </div>

              <div className="journey-connector-down">
                <span className="connector-arrow">↓</span>
              </div>

              <div className="journey-step-item">
                <div className="journey-node-badge node-interp">
                  <span className="journey-step-num">2</span>
                  <span>YOU DEDUCED (INTERPRETATION)</span>
                </div>
                <div className="journey-node-content">
                  <p className="journey-text">
                    "{interpretations[0] || 'This path offers strong immediate advantages for your next step.'}"
                  </p>
                  <span className="journey-sublabel">→ That's your sensible conclusion based on what's visible.</span>
                </div>
              </div>

              <div className="journey-connector-down">
                <span className="connector-arrow">↓</span>
              </div>

              <div className="journey-step-item">
                <div className="journey-node-badge node-assume">
                  <span className="journey-step-num">3</span>
                  <span>YOU'RE ASSUMING (WORTH CHECKING)</span>
                </div>
                <div className="journey-node-content">
                  <p className="journey-text text-amber">
                    "{unstatedAssumptions[0]?.assumption || (assumptions[0]?.assumption || 'Key trade-offs won\'t create hidden friction.')}"
                  </p>
                  <span className="journey-sublabel">? An assumption that's completely normal, but worth verifying.</span>
                </div>
              </div>

              <div className="journey-connector-down">
                <span className="connector-arrow">↓</span>
              </div>

              <div className="journey-step-item highlight-check">
                <div className="journey-node-badge node-check">
                  <span className="journey-step-num">4</span>
                  <span>LET'S CHECK THAT TOGETHER</span>
                </div>
                <div className="journey-node-content">
                  <p className="journey-text text-cyan">
                    "{unstatedAssumptions[0]?.challenge_question || 'What single piece of real-world info would confirm this is safe?'}"
                  </p>
                  <span className="journey-sublabel">✨ Asking this now protects you from surprises later.</span>
                </div>
              </div>
            </div>
          </section>

          {/* 3. ASSUMPTIONS WORTH CHECKING TOGETHER */}
          <section className="human-section">
            <div className="section-title-wrap">
              <h3 className="section-heading">🧠 Assumptions worth checking together</h3>
              <p className="section-subheading">
                A few things are worth exploring before finalizing your commitment.
              </p>
            </div>

            <div className="assumptions-human-grid">
              {unstatedAssumptions.map((ua, idx) => (
                <div key={idx} className="assumption-human-card">
                  <div className="ua-badge">
                    <HelpCircle size={16} className="text-amber" />
                    <span>AN ASSUMPTION WORTH CHECKING</span>
                  </div>

                  <h4 className="ua-statement">"{ua.assumption}"</h4>

                  <div className="ua-reality-box">
                    <span className="ua-label">Something to explore:</span>
                    <p>{ua.reality_check || ua.what_evidence_needed}</p>
                  </div>

                  <div className="ua-challenge-box">
                    <span className="ua-label text-cyan">A question worth asking yourself:</span>
                    <p className="ua-challenge-q">"{ua.challenge_question}"</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 4. WHAT WOULD CHANGE YOUR MIND? (COUNTERFACTUALS) */}
          <section className="human-section">
            <div className="section-title-wrap">
              <h3 className="section-heading">✨ What would change your mind?</h3>
              <p className="section-subheading">
                Let's test one factor at a time to discover what truly drives your decision.
              </p>
            </div>

            <div className="change-mind-cards-grid">
              {changeYourMind.map((cym, idx) => (
                <div key={idx} className="change-mind-card">
                  <span className="cm-step">Scenario {idx + 1}</span>
                  <h4 className="cm-scenario">"{cym.scenario}"</h4>
                  
                  <div className="cm-reveals-box">
                    <span className="cm-reveals-label">What this reveals:</span>
                    <p>{cym.reveals}</p>
                  </div>

                  <div className="cm-actions">
                    <span className="cm-prompt">{cym.reflection_prompt}</span>
                    <div className="cm-button-options">
                      {['Yes, my choice changes', 'No, I would still proceed', 'Not sure, need to verify'].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={`btn-choice-chip ${counterfactualChoice[idx] === opt ? 'active' : ''}`}
                          onClick={() => setCounterfactualChoice(prev => ({ ...prev, [idx]: opt }))}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 5. GUIDED REFLECTION */}
          {reflectionQuestions.length > 0 && (
            <section className="human-section">
              <div className="section-title-wrap">
                <h3 className="section-heading">How confident are you right now?</h3>
                <p className="section-subheading">
                  Select your current stance on these unaddressed areas to calibrate your thinking.
                </p>
              </div>

              <div className="reflection-cards-human-grid">
                {reflectionQuestions.map((rq, idx) => (
                  <div key={rq.id || idx} className="reflection-card-clean">
                    <h4 className="rq-clean-title">{rq.question}</h4>
                    <div className="rq-options-list">
                      {(rq.options || ['Very confident', 'Somewhat confident', 'Unsure', 'Have not verified']).map(opt => (
                        <button
                          key={opt}
                          type="button"
                          className={`rq-option-btn ${reflectionAnswers[rq.id] === opt ? 'active' : ''}`}
                          onClick={() => handleSelectReflection(rq.id, rq.question, opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 6. BEFORE VS AFTER COMPARISON */}
          <section className="human-section">
            <div className="before-after-container">
              <div className="ba-column ba-before-clean">
                <span className="ba-badge text-amber">BEFORE CHITRAGUPTA.AI</span>
                <h4>What you were focusing on:</h4>
                <ul>
                  {facts.map((f, i) => (
                    <li key={i}>✓ {f}</li>
                  ))}
                </ul>
              </div>

              <div className="ba-column ba-after-clean">
                <span className="ba-badge text-cyan">AFTER REFLECTION</span>
                <h4>What you now know needs verification:</h4>
                <ul>
                  {topConsiderations.slice(0, 4).map((tc, i) => (
                    <li key={i}>? {tc.title}</li>
                  ))}
                  {unstatedAssumptions.slice(0, 2).map((ua, i) => (
                    <li key={i}>? Proof for: {ua.assumption}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

        </div>
      )}

      {/* TAB 2: PRE-DECISION CHECKLIST */}
      {activeTab === 'checklist' && (
        <div className="checklist-tab-layout">
          <div className="section-title-wrap">
            <h3 className="section-heading">Your Actionable Pre-Decision Checklist</h3>
            <p className="section-subheading">
              Complete these practical verification steps before saying yes or making your final commitment.
            </p>
          </div>

          <div className="checklist-items-wrap">
            {checklist.map((item, idx) => (
              <div
                key={idx}
                className={`checklist-item-row ${checkedItems[idx] ? 'completed' : ''}`}
                onClick={() => toggleCheckItem(idx)}
              >
                <button type="button" className="checkbox-btn">
                  {checkedItems[idx] ? (
                    <CheckCircle2 size={24} className="text-emerald" />
                  ) : (
                    <Square size={24} className="text-muted" />
                  )}
                </button>

                <div className="item-content">
                  <span className={`item-task-text ${checkedItems[idx] ? 'line-through' : ''}`}>
                    {item.task}
                  </span>
                </div>

                <span className={`importance-tag ${item.importance?.toLowerCase() || 'high'}`}>
                  {item.importance || 'High'} Priority
                </span>
              </div>
            ))}
          </div>

          <div className="checklist-summary-box">
            <p>
              <strong>{Object.values(checkedItems).filter(Boolean).length} of {checklist.length}</strong> verification tasks completed.
            </p>
            <span className="text-muted text-sm">
              The human decision-maker always owns the final choice. Gather the missing facts first!
            </span>
          </div>
        </div>
      )}

      {/* TAB 3: UNDER THE HOOD (DEEP COGNITIVE METRICS FOR JUDGES & POWER USERS) */}
      {activeTab === 'deep-analytics' && (
        <div className="deep-analytics-layout">
          <div className="under-hood-banner">
            <Info size={18} className="text-cyan" />
            <div>
              <strong>Under the Hood: Cognitive Engineering Pipeline</strong>
              <p>
                This technical view contains the structured feature vector, fact/interpretation/assumption extraction,
                and reasoning coverage metrics used behind the scenes.
              </p>
            </div>
          </div>

          {/* Coverage Metrics Strip */}
          <div className="coverage-metrics-strip" style={{ marginTop: '1.5rem' }}>
            <div className="coverage-meter-card">
              <div className="meter-header">
                <span className="meter-label">Reasoning Coverage Gauge</span>
                <span className="meter-value">{coverageScore}%</span>
              </div>
              <div className="meter-track">
                <div
                  className="meter-fill"
                  style={{
                    width: `${coverageScore}%`,
                    background: coverageScore > 75 ? 'linear-gradient(90deg, #10b981, #06b6d4)' : 'linear-gradient(90deg, #f59e0b, #06b6d4)'
                  }}
                ></div>
              </div>
              <span className="meter-disclaimer">
                * Measures reasoning completeness and domain coverage — NOT decision quality or outcome.
              </span>
            </div>

            <div className="metric-stat-box">
              <span className="stat-label">Evidence Coverage</span>
              <span className="stat-num">{Math.round((features.evidence_coverage || 0.5) * 100)}%</span>
              <span className="stat-sub">Verified Claims</span>
            </div>

            <div className="metric-stat-box">
              <span className="stat-label">Assumption Load</span>
              <span className="stat-num">{Math.round((features.assumption_ratio || 0.4) * 100)}%</span>
              <span className="stat-sub">{assumptions.length} Assumptions</span>
            </div>

            <div className="metric-stat-box">
              <span className="stat-label">Identified Blind Spots</span>
              <span className="stat-num text-amber">{blindSpots.length}</span>
              <span className="stat-sub">Overlooked Factors</span>
            </div>
          </div>

          {/* Fact vs Interpretation vs Assumption Deconstruction */}
          <div className="under-hood-section">
            <h3 className="section-heading">Cognitive Deconstruction: Fact vs Interpretation vs Assumption</h3>
            <div className="trio-decomposition-grid">
              {/* FACTS */}
              <div className="decomp-card card-facts">
                <div className="decomp-header">
                  <span className="decomp-tag tag-fact">FACTS</span>
                  <h4>Explicitly Stated</h4>
                </div>
                <ul className="decomp-list">
                  {facts.length === 0 ? <li className="empty-state">No explicit factual claims detected</li> : facts.map((f, i) => (
                    <li key={i}><span className="bullet-fact">✓</span> {f}</li>
                  ))}
                </ul>
              </div>

              {/* INTERPRETATIONS */}
              <div className="decomp-card card-interpretations">
                <div className="decomp-header">
                  <span className="decomp-tag tag-interp">INTERPRETATIONS</span>
                  <h4>Inferred Deductions</h4>
                </div>
                <ul className="decomp-list">
                  {interpretations.length === 0 ? <li className="empty-state">No interpretations drawn</li> : interpretations.map((item, i) => (
                    <li key={i}><span className="bullet-interp">→</span> {item}</li>
                  ))}
                </ul>
              </div>

              {/* ASSUMPTIONS */}
              <div className="decomp-card card-assumptions">
                <div className="decomp-header">
                  <span className="decomp-tag tag-assume">ASSUMPTIONS</span>
                  <h4>Unverified Leaps</h4>
                </div>
                <ul className="decomp-list">
                  {assumptions.length === 0 ? <li className="empty-state">No assumptions identified</li> : assumptions.map((a, i) => (
                    <li key={i}><span className="bullet-assume">?</span> {a.assumption || a}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Reasoning Contradiction Detection */}
          {contradictions.length > 0 && (
            <div className="under-hood-section">
              <h3 className="section-heading">Detected Cognitive Dissonance / Contradictions</h3>
              <div className="contradictions-cards-list">
                {contradictions.map((c, i) => (
                  <div key={i} className="contradiction-alert-box">
                    <div className="contra-title-row">
                      <ShieldAlert size={20} className="text-rose" />
                      <strong>{c.title}</strong>
                    </div>
                    <p className="contra-expl">{c.explanation}</p>
                    <div className="contra-question-box">
                      <span className="contra-q-label">Force-Alignment Question:</span>
                      <p className="contra-q-text">"{c.question}"</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feature Engineering Vector */}
          <div className="under-hood-section">
            <h3 className="section-heading">Lightweight Reasoning Feature Vector</h3>
            <pre className="feature-vector-json">
              {JSON.stringify(features, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
