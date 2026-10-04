import React, { useState } from 'react';
import { Eye, Sparkles, X, Compass, CheckCircle2, ArrowRight, Loader2, Lightbulb } from 'lucide-react';
import api from '../api';

const CATEGORIES = [
  { id: 'Career', label: 'Career', icon: '💼' },
  { id: 'Education', label: 'Education', icon: '🎓' },
  { id: 'Purchase', label: 'Purchase', icon: '🛍️' },
  { id: 'Finance', label: 'Finance', icon: '📈' },
  { id: 'Relocation', label: 'Relocation', icon: '🏡' },
  { id: 'Personal', label: 'Personal', icon: '🌱' },
  { id: 'Project', label: 'Project', icon: '🚀' },
  { id: 'Other', label: 'Other', icon: '⚡' },
];

const PRIORITY_TAGS = [
  'Learning', 'Money', 'Career', 'Time', 'Stability',
  'Convenience', 'Growth', 'Family', 'Education', 'Flexibility'
];

const DEMO_SCENARIO_INTERNSHIP = {
  title: 'Should I accept a 6-month software internship?',
  category: 'Career',
  matters_most: ['Learning', 'Money', 'Convenience'],
  reasoning: 'I have been offered a 6-month software internship. It pays ₹30,000 per month and the company is about 5 km from my home. The working hours are 9 to 6. I want industry experience and the stipend is attractive. I think because it is close to home I will still have enough time for college.'
};

const DEMO_SCENARIO_COLLEGE = {
  title: 'College A (Pune ₹2L) vs College B (Nagpur ₹1L)',
  category: 'Education',
  matters_most: ['Money', 'Career', 'Learning'],
  reasoning: "I got two college options. College A is in Pune and costs ₹2 lakh. College B is in Nagpur and costs ₹1 lakh. My family has financial problems, so I'm thinking of choosing Nagpur because it is cheaper. Pune probably has better placements but I'll have to spend more."
};

export default function BlindSpotIntakeModal({ isOpen, onClose, onSubmitSuccess }) {
  const [title, setTitle] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [category, setCategory] = useState('Career');
  const [selectedPriorities, setSelectedPriorities] = useState(['Learning', 'Money']);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const togglePriority = (p) => {
    setSelectedPriorities(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handlePreFill = (demo) => {
    setTitle(demo.title);
    setCategory(demo.category);
    setSelectedPriorities(demo.matters_most);
    setReasoning(demo.reasoning);
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please state what decision you are thinking about.');
      return;
    }
    if (reasoning.trim().length < 15) {
      setErrorMsg('Please share a few sentences explaining your reasoning (minimum 15 characters).');
      return;
    }

    setErrorMsg('');
    setIsAnalyzing(true);
    setAnalysisStep(0);

    // Sequential Animated Analysis Experience
    const stepInterval = setInterval(() => {
      setAnalysisStep(prev => (prev < 5 ? prev + 1 : prev));
    }, 700);

    try {
      const payload = {
        title: title.trim(),
        reasoning: reasoning.trim(),
        category,
        matters_most: selectedPriorities
      };

      // Call API via Axios client or fallback fetch
      const token = localStorage.getItem('supabase_access_token') || localStorage.getItem('token') || '';
      let createdDecision;
      try {
        const res = await api.post('/api/decisions', payload);
        createdDecision = res.data;
      } catch (axiosErr) {
        const response = await fetch('http://localhost:8000/api/decisions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || axiosErr.response?.data?.detail || 'Analysis could not be completed.');
        }
        createdDecision = await response.json();
      }

      clearInterval(stepInterval);
      setIsAnalyzing(false);
      onSubmitSuccess(createdDecision);
      onClose();
    } catch (err) {
      clearInterval(stepInterval);
      setIsAnalyzing(false);
      setErrorMsg(err.message || 'Network error occurred.');
    }
  };

  const ANALYSIS_STEPS = [
    'Identifying explicit goals and priorities',
    'Separating facts from personal interpretations',
    'Uncovering hidden leap-of-faith assumptions',
    'Checking for reasoning contradictions',
    'Scanning for overlooked domain dimensions',
    'Generating interactive reflection prompts'
  ];

  return (
    <div className="blindspot-modal-backdrop" role="dialog" aria-modal="true">
      <div className="blindspot-modal-container">
        {/* Header */}
        <div className="blindspot-modal-header">
          <div className="blindspot-modal-brand">
            <div className="blindspot-icon-wrapper">
              <Eye size={20} className="blindspot-icon-pulse" />
            </div>
            <div>
              <h2 className="blindspot-modal-title">Analyze a Decision</h2>
              <p className="blindspot-modal-subtitle">Examine your reasoning for hidden assumptions and overlooked factors.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="blindspot-close-btn" aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Loading Overlay */}
        {isAnalyzing && (
          <div className="blindspot-loading-stage" aria-live="polite">
            <div className="blindspot-loading-glow"></div>
            <Loader2 size={42} className="spin blindspot-spin-icon" />
            <h3 className="blindspot-loading-title">Examining your reasoning...</h3>
            <p className="blindspot-loading-caption">Deconstructing claims, stress-testing assumptions, and identifying cognitive blind spots.</p>

            <div className="blindspot-steps-list">
              {ANALYSIS_STEPS.map((step, idx) => (
                <div
                  key={step}
                  className={`blindspot-step-item ${idx < analysisStep ? 'completed' : idx === analysisStep ? 'active' : 'pending'}`}
                >
                  <div className="step-icon">
                    {idx < analysisStep ? (
                      <CheckCircle2 size={16} className="text-emerald" />
                    ) : idx === analysisStep ? (
                      <span className="step-pulsing-dot"></span>
                    ) : (
                      <span className="step-waiting-dot"></span>
                    )}
                  </div>
                  <span className="step-text">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Form */}
        {!isAnalyzing && (
          <form onSubmit={handleSubmit} className="blindspot-modal-body">
            {errorMsg && (
              <div className="blindspot-alert-error" role="alert">
                {errorMsg}
              </div>
            )}

            {/* Quick Demo Buttons */}
            <div className="blindspot-demo-banner">
              <div className="demo-text">
                <Lightbulb size={16} className="text-amber" />
                <span>Want to see an instant demonstration?</span>
              </div>
              <div className="demo-buttons-group" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handlePreFill(DEMO_SCENARIO_INTERNSHIP)}
                  className="btn-demo-fill"
                >
                  <Sparkles size={14} />
                  6-Month Internship Offer
                </button>
                <button
                  type="button"
                  onClick={() => handlePreFill(DEMO_SCENARIO_COLLEGE)}
                  className="btn-demo-fill"
                  style={{ background: 'rgba(168, 85, 247, 0.15)', borderColor: 'rgba(168, 85, 247, 0.35)', color: '#c084fc' }}
                >
                  <Sparkles size={14} />
                  Pune vs Nagpur College
                </button>
              </div>
            </div>

            {/* Decision Title */}
            <div className="form-field-group">
              <label htmlFor="decision-title" className="field-label">
                What decision are you thinking about? <span className="required-star">*</span>
              </label>
              <input
                id="decision-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Should I accept this 6-month software internship?"
                className="blindspot-input-text"
                autoFocus
              />
            </div>

            {/* Category Selector */}
            <div className="form-field-group">
              <label className="field-label">Decision Domain</label>
              <div className="category-chips-grid">
                {CATEGORIES.map((cat) => (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`category-chip ${category === cat.id ? 'active' : ''}`}
                  >
                    <span className="cat-icon">{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Reasoning Textarea */}
            <div className="form-field-group">
              <label htmlFor="decision-reasoning" className="field-label">
                Tell us how you're thinking about it <span className="required-star">*</span>
              </label>
              <textarea
                id="decision-reasoning"
                rows={5}
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                placeholder="Explain why you are leaning toward this decision, what information you currently have, what feels attractive, and any reservations you hold..."
                className="blindspot-textarea"
              />
              <span className="field-hint">
                Be as honest and candid as possible. The AI does not judge your choices; it reveals what may be unstated or overlooked.
              </span>
            </div>

            {/* Priority Tags */}
            <div className="form-field-group">
              <label className="field-label">What matters most to you right now?</label>
              <div className="priority-chips-wrap">
                {PRIORITY_TAGS.map((tag) => {
                  const isSelected = selectedPriorities.includes(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => togglePriority(tag)}
                      className={`priority-chip ${isSelected ? 'active' : ''}`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="blindspot-modal-footer">
              <button
                type="button"
                onClick={onClose}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-analyze-submit"
              >
                <Sparkles size={16} />
                <span>Find My Blind Spots</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
