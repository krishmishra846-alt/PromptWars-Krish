import React, { useState } from 'react';
import {
  Eye, EyeOff, PlusCircle, Sparkles, ArrowRight, Trash2, Calendar, FileText,
  Lightbulb, Compass, HelpCircle, Shuffle, CheckCircle2, ChevronRight, ChevronDown, ChevronUp
} from 'lucide-react';

export default function BlindSpotDashboard({
  user = null,
  decisions = [],
  loading = false,
  onOpenCreate,
  onSelectDecision,
  onDeleteDecision,
  onRunDemo
}) {
  const [hidePastDecisions, setHidePastDecisions] = useState(false);

  // Extract user's first name for a natural friendly greeting
  const rawName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const firstName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  // Time of day greeting
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="blindspot-dashboard-wrap">
      {/* Warm & Welcoming Hero Section */}
      <section className="blindspot-hero" aria-labelledby="hero-title">
        <div className="hero-content-block">
          <div className="hero-pill-badge">
            <span className="hero-badge-sparkle">✨</span>
            <span>YOUR PERSONAL THINKING COMPANION</span>
          </div>

          <h1 id="hero-title" className="hero-main-title">
            {firstName ? `${timeGreeting}, ${firstName} 👋` : 'Good thinking starts with good questions.'}
          </h1>

          <p className="hero-description">
            {firstName ? (
              <span>What are you thinking about today? You've already weighed some key factors—let's discover what might be hiding outside your current view.</span>
            ) : (
              <span>You've already considered some important factors. Let's explore what might be hiding outside your current view without ever telling you what to choose.</span>
            )}
          </p>

          <div className="hero-actions-group">
            <button
              type="button"
              onClick={onOpenCreate}
              className="btn btn-hero-primary"
            >
              <PlusCircle size={18} />
              <span>✨ Explore a Decision</span>
            </button>

            <button
              type="button"
              onClick={onRunDemo}
              className="btn btn-hero-secondary"
            >
              <Sparkles size={16} className="text-amber" />
              <span>Try Live Demo: 6-Month Internship</span>
            </button>
          </div>

          {/* Small Horizontal "How it Works" Visual Strip */}
          <div className="how-it-works-strip">
            <div className="hiw-step">
              <span className="hiw-step-icon">🧠</span>
              <div className="hiw-step-text">
                <strong className="hiw-step-title">You think</strong>
                <span className="hiw-step-sub">Share what you're weighing</span>
              </div>
            </div>

            <span className="hiw-arrow">→</span>

            <div className="hiw-step">
              <span className="hiw-step-icon">🔍</span>
              <div className="hiw-step-text">
                <strong className="hiw-step-title">We explore</strong>
                <span className="hiw-step-sub">Find hidden assumptions</span>
              </div>
            </div>

            <span className="hiw-arrow">→</span>

            <div className="hiw-step">
              <span className="hiw-step-icon">💭</span>
              <div className="hiw-step-text">
                <strong className="hiw-step-title">You reflect</strong>
                <span className="hiw-step-sub">Ask what you didn't ask</span>
              </div>
            </div>

            <span className="hiw-arrow">→</span>

            <div className="hiw-step highlight-decide">
              <span className="hiw-step-icon">🌱</span>
              <div className="hiw-step-text">
                <strong className="hiw-step-title">You decide</strong>
                <span className="hiw-step-sub">You always own the choice</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* "You Might Want to Explore..." Curiosity Section */}
      <section className="explore-prompts-section">
        <div className="prompts-header">
          <h2 className="prompts-title">✨ Ways we can help you think</h2>
          <p className="prompts-caption">Pick any angle to explore your upcoming choices without pressure.</p>
        </div>

        <div className="prompts-grid" role="list">
          <div
            className="prompt-card"
            onClick={onOpenCreate}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpenCreate()}
            role="button"
            tabIndex={0}
            aria-label="Explore your biggest assumption"
          >
            <div className="prompt-icon-wrap icon-amber" aria-hidden="true">
              <HelpCircle size={22} />
            </div>
            <div className="prompt-content">
              <strong className="prompt-label">Your biggest assumption</strong>
              <p className="prompt-desc">What leap of faith is your current choice quietly depending on?</p>
            </div>
            <ChevronRight size={16} className="prompt-arrow" aria-hidden="true" />
          </div>

          <div
            className="prompt-card"
            onClick={onOpenCreate}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpenCreate()}
            role="button"
            tabIndex={0}
            aria-label="Explore an unanswered question"
          >
            <div className="prompt-icon-wrap icon-cyan" aria-hidden="true">
              <Lightbulb size={22} />
            </div>
            <div className="prompt-content">
              <strong className="prompt-label">An unanswered question</strong>
              <p className="prompt-desc">What single piece of missing data would completely change your mind?</p>
            </div>
            <ChevronRight size={16} className="prompt-arrow" aria-hidden="true" />
          </div>

          <div
            className="prompt-card"
            onClick={onOpenCreate}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpenCreate()}
            role="button"
            tabIndex={0}
            aria-label="Explore changing one factor"
          >
            <div className="prompt-icon-wrap icon-purple" aria-hidden="true">
              <Shuffle size={22} />
            </div>
            <div className="prompt-content">
              <strong className="prompt-label">Let's change one thing</strong>
              <p className="prompt-desc">Test whether money, convenience, or learning is your true anchor.</p>
            </div>
            <ChevronRight size={16} className="prompt-arrow" aria-hidden="true" />
          </div>

          <div
            className="prompt-card"
            onClick={onOpenCreate}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpenCreate()}
            role="button"
            tabIndex={0}
            aria-label="Explore pre-decision checklist"
          >
            <div className="prompt-icon-wrap icon-emerald" aria-hidden="true">
              <Compass size={22} />
            </div>
            <div className="prompt-content">
              <strong className="prompt-label">A pre-decision checklist</strong>
              <p className="prompt-desc">Concrete verification steps to check off before saying yes.</p>
            </div>
            <ChevronRight size={16} className="prompt-arrow" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* Decisions List Section */}
      <section className="decisions-history-section">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">Your Decision Journeys</h2>
            <p className="section-caption">Explore past insights, checked assumptions, and reflection sessions.</p>
          </div>
          
          <div className="section-header-actions">
            {decisions.length > 0 && (
              <button
                type="button"
                className="btn-toggle-past-decisions"
                onClick={() => setHidePastDecisions(prev => !prev)}
                title={hidePastDecisions ? "Show past decision journeys" : "Hide past decision journeys for a clean space"}
              >
                {hidePastDecisions ? (
                  <>
                    <Eye size={15} className="text-cyan" />
                    <span>Show Past Journeys ({decisions.length})</span>
                  </>
                ) : (
                  <>
                    <EyeOff size={15} />
                    <span>Hide Past Journeys</span>
                  </>
                )}
              </button>
            )}

            <span className="decisions-count-badge">
              🌱 {decisions.length} {decisions.length === 1 ? 'Decision Explored' : 'Decisions Explored'}
            </span>
          </div>
        </div>

        {hidePastDecisions && decisions.length > 0 ? (
          /* Clean, Uncongested Collapsed State */
          <div className="past-decisions-collapsed-card">
            <div className="collapsed-info-block">
              <span className="collapsed-icon">🌿</span>
              <div>
                <strong className="collapsed-title">Past decision journeys are hidden for a clean thinking space.</strong>
                <p className="collapsed-sub">
                  {decisions.length} {decisions.length === 1 ? 'journey saved' : 'journeys saved'} — kept safely here whenever you want to revisit them.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-show-past-pill"
              onClick={() => setHidePastDecisions(false)}
            >
              <Eye size={14} />
              <span>Show {decisions.length} Journeys</span>
            </button>
          </div>
        ) : loading ? (
          <div className="decisions-loading-grid">
            <div className="decision-skeleton-card"></div>
            <div className="decision-skeleton-card"></div>
          </div>
        ) : decisions.length === 0 ? (
          /* Warm & Encouraging Empty State */
          <div className="decisions-empty-card">
            <div className="empty-icon-circle-warm">
              <span className="empty-emoji">🌱</span>
            </div>
            <h3 className="empty-title">Your thinking space is empty... for now.</h3>
            <p className="empty-desc">
              Whenever you're facing an important choice—an internship offer, college decision, major purchase, or relocation—bring it here and we'll explore it together.
            </p>
            <div className="empty-buttons-row">
              <button
                type="button"
                onClick={onOpenCreate}
                className="btn btn-hero-primary"
              >
                <PlusCircle size={16} />
                <span>Explore Your First Decision</span>
              </button>
              <button
                type="button"
                onClick={onRunDemo}
                className="btn btn-secondary"
              >
                <Sparkles size={16} className="text-amber" />
                <span>Try 6-Month Internship Demo</span>
              </button>
            </div>
          </div>
        ) : (
          /* Decisions Cards Grid */
          <div className="decisions-cards-grid">
            {decisions.map((dec) => {
              const data = dec.data || {};
              const analysis = data.analysis || {};
              const features = data.features || analysis.features || {};
              const coverage = analysis.coverage_score || features.coverage_score || 65;
              const blindSpotsCount = (analysis.blind_spots || []).length || (analysis.top_considerations || []).length || 3;
              const assumptionsCount = (analysis.assumptions || []).length || (analysis.unstated_assumptions || []).length || 2;

              // Supportive coverage phrasing (never judgmental)
              const coverageMessage = coverage >= 70
                ? 'Several key dimensions already covered'
                : coverage >= 45
                ? 'Good start — room to explore a few angles'
                : 'Early stage — worth looking a little deeper';

              return (
                <article key={dec.id} className="decision-card">
                  <div className="dec-card-header">
                    <span className="dec-category-tag">{data.category || 'Career'}</span>
                    <span className="dec-time">
                      {new Date(dec.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <h3
                    className="dec-card-title"
                    onClick={() => onSelectDecision(dec)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectDecision(dec)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open decision analysis for ${dec.title}`}
                  >
                    {dec.title}
                  </h3>

                  <p className="dec-card-snippet">
                    "{data.reasoning ? (data.reasoning.length > 120 ? data.reasoning.slice(0, 120) + '...' : data.reasoning) : ''}"
                  </p>

                  {/* Supportive Coverage Indicator */}
                  <div className="dec-card-coverage-strip">
                    <div className="dec-cov-header">
                      <span className="dec-cov-label">{coverageMessage}</span>
                      <span className="dec-cov-score">{coverage}% explored</span>
                    </div>
                    <div className="dec-cov-bar">
                      <div
                        className="dec-cov-fill"
                        style={{
                          width: `${coverage}%`,
                          background: coverage > 70 ? 'linear-gradient(90deg, #10b981, #06b6d4)' : 'linear-gradient(90deg, #f59e0b, #06b6d4)'
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Positive Insight Badges */}
                  <div className="dec-card-meta-chips">
                    <span className="dec-meta-chip chip-insight">
                      <Lightbulb size={13} className="text-amber" />
                      {blindSpotsCount} insights discovered
                    </span>
                    <span className="dec-meta-chip chip-assumption">
                      <CheckCircle2 size={13} className="text-cyan" />
                      {assumptionsCount} assumptions checked
                    </span>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="dec-card-footer">
                    <button
                      type="button"
                      onClick={() => onDeleteDecision(dec.id)}
                      className="btn-delete-card"
                      title="Remove this decision journey"
                    >
                      <Trash2 size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectDecision(dec)}
                      className="btn-view-report"
                    >
                      <span>Continue Exploring</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
