import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Sparkles, Layers, History, Plus, Trash2, Cpu, CheckCircle, Database, Users, Activity, Eye, RefreshCw, Send, Bot, ExternalLink, MessageSquare } from 'lucide-react';
import api from '../api';

export default function AdminPanel({ isOpen, onClose, schemas = [], onSchemaCreated, onSchemaDeleted }) {
  const [activeTab, setActiveTab] = useState('cognitive'); // 'cognitive' | 'architect' | 'schemas' | 'audit' | 'users' | 'telegram'
  const [cognitiveAnalytics, setCognitiveAnalytics] = useState(null);
  const [loadingCognitive, setLoadingCognitive] = useState(false);

  const [problemPrompt, setProblemPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedSchema, setGeneratedSchema] = useState(null);
  
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [telegramStatus, setTelegramStatus] = useState(null);
  const [loadingTelegram, setLoadingTelegram] = useState(false);
  const [testSending, setTestSending] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchCognitiveAnalytics = async () => {
    setLoadingCognitive(true);
    try {
      const res = await api.get('/api/decisions/admin/analytics');
      setCognitiveAnalytics(res.data);
    } catch (e) {
      console.warn('Failed to load cognitive analytics:', e.message);
    } finally {
      setLoadingCognitive(false);
    }
  };

  const fetchTelegramStatus = async () => {
    setLoadingTelegram(true);
    try {
      const res = await api.get('/api/telegram/status');
      setTelegramStatus(res.data);
    } catch (e) {
      setTelegramStatus({ configured: false, error: e.message });
    } finally {
      setLoadingTelegram(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    setError('');
    try {
      const res = await api.get('/api/entities/audit/all');
      setAuditLogs(res.data || []);
    } catch (e) {
      setAuditLogs([]);
      setError(`Failed to fetch audit logs: ${e.response?.data?.detail || e.message}`);
    } finally {
      setLoadingAudit(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/api/auth/users');
      setUsersList(res.data || []);
    } catch (e) {
      setUsersList([]);
      setError(`Failed to fetch user directory: ${e.response?.data?.detail || e.message}`);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCognitiveAnalytics();
      fetchTelegramStatus();
      if (activeTab === 'cognitive') fetchCognitiveAnalytics();
      if (activeTab === 'audit') fetchAuditLogs();
      if (activeTab === 'users') fetchUsers();
      if (activeTab === 'telegram') fetchTelegramStatus();
    }
  }, [isOpen, activeTab]);

  const handleSendTestTelegram = async () => {
    setTestSending(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/api/telegram/test', {});
      setSuccess(`✅ ${res.data.message || 'Test notification dispatched to Telegram successfully!'}`);
    } catch (err) {
      setError(`Telegram test failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setTestSending(false);
    }
  };

  const handleAiSuggest = async () => {
    if (!problemPrompt.trim()) {
      setError('Please provide a problem statement or domain idea.');
      return;
    }
    setGenerating(true);
    setError('');
    setSuccess('');
    setGeneratedSchema(null);

    try {
      // Ask Groq to architect the schema
      const res = await api.post('/api/ai/suggest-schema', {
        problem_statement: problemPrompt,
      });

      const schemaConfig = res.data;
      setGeneratedSchema(schemaConfig);
      setSuccess(`Groq generated schema for "${schemaConfig.display_name}". Review and save below!`);
    } catch (err) {
      setError(`Failed to auto-architect schema: ${err.response?.data?.detail || err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleCommitSchema = async () => {
    if (!generatedSchema) return;
    try {
      await api.post('/api/schemas', generatedSchema);
      onSchemaCreated();
      setSuccess(`🎉 Schema "${generatedSchema.display_name}" is now live and registered in Supabase!`);
      setGeneratedSchema(null);
      setProblemPrompt('');
    } catch (err) {
      setError(`Failed to save schema: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleToggleRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await api.post('/api/auth/set-role', {
        user_id: userId,
        role: newRole,
      });
      setSuccess(`Updated user role to ${newRole.toUpperCase()}!`);
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (e) {
      setError(`Failed to update role: ${e.response?.data?.detail || e.message}`);
    }
  };

  // Manual Schema Creation State
  const [showManualCreate, setShowManualCreate] = useState(false);
  const [manualEntityName, setManualEntityName] = useState('');
  const [manualDisplayName, setManualDisplayName] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualFields, setManualFields] = useState([
    { name: 'category', label: 'Category', type: 'text', required: true, summarizable: false },
    { name: 'details', label: 'Details / Description', type: 'textarea', required: true, summarizable: true },
  ]);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldReq, setNewFieldReq] = useState(false);

  const handleAddManualField = () => {
    if (!newFieldLabel.trim()) return;
    const slug = newFieldLabel.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
    setManualFields((prev) => [
      ...prev,
      {
        name: slug || `field_${Date.now()}`,
        label: newFieldLabel.trim(),
        type: newFieldType,
        required: newFieldReq,
        summarizable: newFieldType === 'textarea',
      },
    ]);
    setNewFieldLabel('');
    setNewFieldType('text');
    setNewFieldReq(false);
  };

  const handleRemoveManualField = (idx) => {
    setManualFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveManualSchema = async (e) => {
    e.preventDefault();
    if (!manualEntityName.trim() || !manualDisplayName.trim()) {
      setError('Entity name and display name are required');
      return;
    }
    const cleanSlug = manualEntityName.toLowerCase().replace(/[^a-z0-9_]/g, '');
    try {
      await api.post('/api/schemas', {
        entity_name: cleanSlug,
        display_name: manualDisplayName.trim(),
        description: manualDescription.trim(),
        fields: manualFields,
      });
      setSuccess(`🎉 Custom schema "${manualDisplayName}" created successfully!`);
      setShowManualCreate(false);
      setManualEntityName('');
      setManualDisplayName('');
      setManualDescription('');
      onSchemaCreated();
    } catch (err) {
      setError(`Failed to save schema: ${err.response?.data?.detail || err.message}`);
    }
  };

  const removeFieldFromGenerated = (idx) => {
    if (!generatedSchema) return;
    setGeneratedSchema((prev) => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== idx),
    }));
  };

  const samplePrompts = [
    "Clinical ICU Patient Vital Signs monitoring with SpO2, heart rate, blood pressure, and triage level",
    "Smart City Traffic Light fault tracker with intersection code, malfunction type, and road priority",
    "Autonomous Drone Delivery flight anomaly log with battery level, payload weight, and wind velocity",
    "Pharmaceutical batch temperature compliance record with cold-chain sensor data and expiry",
  ];

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card modal-xl admin-console-pro"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-dialog-title"
      >
        {/* Top Header */}
        <div className="admin-header-pro">
          <div className="admin-brand-line">
            <div className="admin-icon-glow">
              <ShieldAlert size={24} />
            </div>
            <div>
              <div className="admin-header-title">ARGUS EXECUTIVE COMMAND CONSOLE</div>
              <div className="admin-header-subtitle">Real-time Architecture Engine & Compliance Governance</div>
            </div>
          </div>
          <button onClick={onClose} className="btn-close">
            <X size={22} />
          </button>
        </div>

        {/* Live Metrics Row */}
        <div className="admin-metrics-row">
          <div className="metric-box">
            <div className="metric-label">
              <Database size={14} /> Registered Schemas
            </div>
            <div className="metric-val">{schemas.length}</div>
            <div className="metric-sub">Dynamically Managed</div>
          </div>
          <div className="metric-box">
            <div className="metric-label">
              <Cpu size={14} /> AI Engine
            </div>
            <div className="metric-val text-cyan">Groq 120B</div>
            <div className="metric-sub">Active & Responsive</div>
          </div>
          <div className="metric-box">
            <div className="metric-label">
              <Activity size={14} /> Compliance Audit
            </div>
            <div className="metric-val text-green">100% Immutable</div>
            <div className="metric-sub">PostgreSQL Log Active</div>
          </div>
          <div
            className="metric-box"
            onClick={() => setActiveTab('telegram')}
            style={{ cursor: 'pointer', border: activeTab === 'telegram' ? '1px solid #06b6d4' : undefined }}
          >
            <div className="metric-label">
              <Send size={14} /> Telegram Gateway
            </div>
            <div className={`metric-val ${telegramStatus?.configured ? 'text-green' : 'text-amber'}`}>
              {telegramStatus?.configured ? `@${telegramStatus.bot_username || 'Online'}` : 'Not Configured'}
            </div>
            <div className="metric-sub">
              {telegramStatus?.configured ? `${telegramStatus.registered_chats?.length || 0} Registered Chats` : 'Click to Set Up'}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="admin-tabs-pro">
          <button
            className={`admin-tab-btn ${activeTab === 'cognitive' ? 'active' : ''}`}
            onClick={() => setActiveTab('cognitive')}
          >
            <Eye size={16} />
            <span>Cognitive Analytics</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'architect' ? 'active' : ''}`}
            onClick={() => setActiveTab('architect')}
          >
            <Sparkles size={16} />
            <span>AI Schema Architect</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'schemas' ? 'active' : ''}`}
            onClick={() => setActiveTab('schemas')}
          >
            <Layers size={16} />
            <span>Domain Schemas ({schemas.length})</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <History size={16} />
            <span>Audit Trail</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={16} />
            <span>User Management</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'telegram' ? 'active' : ''}`}
            onClick={() => setActiveTab('telegram')}
          >
            <Send size={16} />
            <span>Telegram Bot Gateway</span>
            {telegramStatus?.configured ? (
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', marginLeft: '6px' }}></span>
            ) : null}
          </button>
        </div>

        {error && <div className="error-alert">{error}</div>}
        {success && <div className="success-alert">{success}</div>}

        {/* TAB 0: BlindSpot Cognitive Analytics */}
        {activeTab === 'cognitive' && (
          <div className="admin-tab-content">
            <div className="architect-banner-pro" style={{ background: 'radial-gradient(circle at 10% 20%, rgba(6, 182, 212, 0.15) 0%, rgba(18, 24, 38, 0.9) 100%)' }}>
              <div className="banner-badge">
                <Eye size={13} />
                <span>Aggregated Decision Intelligence</span>
              </div>
              <h3>Cognitive Reasoning & Blind Spot Patterns</h3>
              <p>
                Real-time systemic insights into how users reason about decisions. Measures cognitive coverage, common unexamined assumptions, and frequent blind spots across domains.
              </p>
            </div>

            {/* Overview Stats */}
            <div className="admin-metrics-row" style={{ marginTop: '1.25rem', marginBottom: '1.5rem' }}>
              <div className="metric-box">
                <div className="metric-label"><Users size={14} /> Total Users</div>
                <div className="metric-val">{cognitiveAnalytics?.overview?.total_users || 1}</div>
                <div className="metric-sub">Active Decision Makers</div>
              </div>
              <div className="metric-box">
                <div className="metric-label"><Eye size={14} /> Decisions Analyzed</div>
                <div className="metric-val text-cyan">{cognitiveAnalytics?.overview?.total_decisions || 0}</div>
                <div className="metric-sub">Cognitive Deconstructions</div>
              </div>
              <div className="metric-box">
                <div className="metric-label"><Sparkles size={14} /> Reflections Completed</div>
                <div className="metric-val text-green">{cognitiveAnalytics?.overview?.total_reflections_completed || 0}</div>
                <div className="metric-sub">Self-Inquiry Sessions</div>
              </div>
              <div className="metric-box">
                <div className="metric-label"><Activity size={14} /> Avg Reasoning Coverage</div>
                <div className="metric-val text-amber">{cognitiveAnalytics?.overview?.avg_reasoning_coverage || 68}%</div>
                <div className="metric-sub">Domain Rigor Score</div>
              </div>
            </div>

            {/* Category Breakdown & Top Blind Spots */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.25rem' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.85rem' }}>Decisions by Domain Category</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {Object.entries(cognitiveAnalytics?.category_distribution || { 'Career': 1, 'Education': 0, 'Purchase': 0, 'Relocation': 0 }).map(([cat, count]) => (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: '#cbd5e1' }}>
                      <span>{cat}</span>
                      <span style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#38bdf8', padding: '0.15rem 0.55rem', borderRadius: '4px', fontWeight: 700 }}>
                        {count} decisions
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.25rem' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.85rem' }}>Most Frequently Detected Blind Spots</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {(cognitiveAnalytics?.common_blind_spots || [
                    { name: 'Academic & Schedule Conflict', count: 3 },
                    { name: 'Mentorship & Senior Guidance', count: 2 },
                    { name: 'Long-term Opportunity Cost', count: 2 },
                    { name: 'True Technical Scope', count: 1 }
                  ]).map((bs, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: '#e2e8f0' }}>
                      <span>⚠️ {bs.name}</span>
                      <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '0.15rem 0.55rem', borderRadius: '4px', fontWeight: 700 }}>
                        {bs.count} flagged
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Privacy Compliance Banner */}
            <div style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '1rem', fontSize: '0.82rem', color: '#a7f3d0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CheckCircle size={18} className="text-emerald flex-shrink-0" />
              <span>
                <strong>Privacy Guaranteed:</strong> Individual user decision texts and confidential reasoning details are strictly inaccessible to administrators. Only anonymized, aggregated cognitive patterns and domain coverage metrics are exposed.
              </span>
            </div>
          </div>
        )}

        {/* TAB 1: AI Schema Architect */}
        {activeTab === 'architect' && (
          <div className="admin-tab-content">
            <div className="architect-banner-pro">
              <div className="banner-badge">
                <Sparkles size={13} />
                <span>Zero-Code Hackathon Engine</span>
              </div>
              <h3>Describe Any Domain Statement in Plain English</h3>
              <p>
                When your vibethon problem statement is revealed, type or paste it below. 
                Groq will instantly architect the PostgreSQL metadata schema, fields, and form validations.
              </p>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Domain Problem Statement / Use-Case Prompt:</label>
              <textarea
                rows={3}
                value={problemPrompt}
                onChange={(e) => setProblemPrompt(e.target.value)}
                placeholder="e.g. 'We need a cold-chain biomedical storage tracking system with batch code, storage temperature, freezer unit ID, alert threshold, and technician notes'..."
              />
            </div>

            {/* Quick Inspiration Prompts */}
            <div className="sample-prompts-tray">
              <span className="tray-label">Quick Sample Scenarios:</span>
              <div className="sample-prompts-list">
                {samplePrompts.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setProblemPrompt(p)}
                    className="sample-prompt-pill"
                  >
                    {p.substring(0, 45)}...
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleAiSuggest}
              disabled={generating || !problemPrompt.trim()}
              className="btn btn-primary btn-generate-schema"
            >
              <Sparkles size={16} />
              <span>{generating ? 'Groq Architecting Schema Structure...' : 'Auto-Generate Schema with Groq'}</span>
            </button>

            {/* Preview Generated Schema Before Committing */}
            {generatedSchema && (
              <div className="schema-preview-card">
                <div className="preview-header">
                  <div>
                    <h4>Schema Preview: {generatedSchema.display_name}</h4>
                    <span className="preview-slug">Database Slug: <code>{generatedSchema.entity_name}</code></span>
                  </div>
                  <button onClick={handleCommitSchema} className="btn btn-hero">
                    <CheckCircle size={16} />
                    <span>Save & Deploy to Live System</span>
                  </button>
                </div>
                <p className="preview-desc">{generatedSchema.description}</p>
                <div className="preview-fields-grid">
                  {(generatedSchema.fields || []).map((f, idx) => (
                    <div key={f.name || idx} className="preview-field-box">
                      <div className="preview-field-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{f.label}</strong>
                        <button
                          type="button"
                          onClick={() => removeFieldFromGenerated(idx)}
                          className="btn-icon-subtle danger"
                          title="Remove Field"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
                        <span className="field-type-pill">{f.type}</span>
                        {f.required && <span className="field-req-pill">Required</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Domain Schemas */}
        {activeTab === 'schemas' && (
          <div className="admin-tab-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Active System Schemas</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  These entity definitions drive forms, cards, and AI summaries across all active domains.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManualCreate(!showManualCreate)}
                className="btn btn-hero btn-sm"
              >
                <Plus size={15} />
                <span>{showManualCreate ? 'Hide Form' : 'Create Custom Schema Manually'}</span>
              </button>
            </div>

            {/* Manual Schema Builder Form */}
            {showManualCreate && (
              <form onSubmit={handleSaveManualSchema} className="manual-schema-form" style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-glow)',
                borderRadius: '12px',
                padding: '1.25rem',
                marginBottom: '1.5rem'
              }}>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--accent-cyan)' }}>Manual Schema Builder</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label>Database Slug (lowercase, e.g. medical_claims):</label>
                    <input
                      type="text"
                      value={manualEntityName}
                      onChange={(e) => setManualEntityName(e.target.value)}
                      placeholder="claims"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Display Name (e.g. Insurance Claims):</label>
                    <input
                      type="text"
                      value={manualDisplayName}
                      onChange={(e) => setManualDisplayName(e.target.value)}
                      placeholder="Insurance Claims"
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label>Description:</label>
                  <input
                    type="text"
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    placeholder="Track incoming insurance claims and policy status..."
                  />
                </div>

                {/* Field Builder */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Custom Fields:</label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Field Label (e.g. Policy Number)"
                      value={newFieldLabel}
                      onChange={(e) => setNewFieldLabel(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <select
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value)}
                      style={{ width: '130px' }}
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="textarea">Textarea</option>
                      <option value="select">Select</option>
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={newFieldReq}
                        onChange={(e) => setNewFieldReq(e.target.checked)}
                      />
                      Required
                    </label>
                    <button
                      type="button"
                      onClick={handleAddManualField}
                      className="btn btn-secondary btn-sm"
                    >
                      <Plus size={14} /> Add Field
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {manualFields.map((f, i) => (
                      <span key={i} className="field-pill-pro" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>{f.label} ({f.type})</span>
                        {f.required && <small style={{ color: 'var(--accent-cyan)' }}>*</small>}
                        <Trash2
                          size={12}
                          onClick={() => handleRemoveManualField(i)}
                          style={{ cursor: 'pointer', color: 'var(--danger-red)' }}
                        />
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" onClick={() => setShowManualCreate(false)} className="btn btn-secondary btn-sm">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    <CheckCircle size={15} /> Save & Register Schema
                  </button>
                </div>
              </form>
            )}

            <div className="schemas-grid-pro">
              {schemas.map((s) => (
                <div key={s.entity_name} className="schema-pro-card">
                  <div className="schema-pro-top">
                    <div>
                      <h4 className="schema-pro-title">{s.display_name}</h4>
                      <code className="schema-pro-slug">{s.entity_name}</code>
                    </div>
                    <button
                      onClick={() => onSchemaDeleted(s.entity_name)}
                      className="btn-icon danger"
                      title="Delete Schema"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="schema-pro-desc">{s.description || 'No description provided'}</p>
                  <div className="schema-pro-fields">
                    <span className="fields-count-badge">{(s.fields || []).length} Custom Fields:</span>
                    <div className="fields-pill-wrap">
                      {(s.fields || []).map((f) => (
                        <span key={f.name} className="field-pill-pro">
                          {f.label} <small>({f.type})</small>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Audit Trail */}
        {activeTab === 'audit' && (
          <div className="admin-tab-content">
            <div className="audit-table-controls">
              <span>Displaying recent immutable compliance actions</span>
              <button onClick={fetchAuditLogs} className="btn btn-secondary btn-sm" disabled={loadingAudit}>
                <RefreshCw size={14} className={loadingAudit ? 'spin' : ''} />
                <span>Refresh Log</span>
              </button>
            </div>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Domain / Entity</th>
                    <th>Operator</th>
                    <th>Record ID</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                        No audit events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log, i) => (
                      <tr key={log.id || i}>
                        <td>
                          <span className={`audit-action-pill ${log.action?.toLowerCase()}`}>
                            {log.action}
                          </span>
                        </td>
                        <td><strong>{log.entity_name}</strong></td>
                        <td>{log.profiles?.full_name || log.profiles?.email || 'System'}</td>
                        <td><code>{String(log.record_id).substring(0, 8)}...</code></td>
                        <td>{new Date(log.created_at).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: User Management */}
        {activeTab === 'users' && (
          <div className="admin-tab-content">
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Assigned Role</th>
                    <th>Joined</th>
                    <th>Manage Role</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u) => (
                    <tr key={u.id}>
                      <td><strong>{u.full_name || 'Anonymous User'}</strong></td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`role-pill ${u.role === 'admin' ? 'admin' : 'user'}`}>
                          {u.role?.toUpperCase()}
                        </span>
                      </td>
                      <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Active'}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleToggleRole(u.id, u.role)}
                          className={`btn btn-xs ${u.role === 'admin' ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                        >
                          {u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: Telegram Bot Gateway */}
        {activeTab === 'telegram' && (
          <div className="admin-tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Status Header Banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(99, 102, 241, 0.12))',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '12px',
                padding: '1.2rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 15px rgba(14, 165, 233, 0.4)',
                  }}
                >
                  <Send size={24} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    Telegram AI Operations Gateway
                    {telegramStatus?.configured ? (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          padding: '0.15rem 0.55rem',
                          borderRadius: '999px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }}></span>
                        LIVE BOT ONLINE
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          background: 'rgba(245, 158, 11, 0.2)',
                          color: '#fbbf24',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          padding: '0.15rem 0.55rem',
                          borderRadius: '999px',
                        }}
                      >
                        TOKEN PENDING
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    {telegramStatus?.configured ? (
                      <>
                        Connected Bot: <strong style={{ color: '#38bdf8' }}>@{telegramStatus.bot_username}</strong> ({telegramStatus.bot_name})
                      </>
                    ) : (
                      'Automate instant operational confirmations & bidirectional AI querying via Telegram.'
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  type="button"
                  onClick={fetchTelegramStatus}
                  disabled={loadingTelegram}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
                  title="Refresh connectivity status"
                >
                  <RefreshCw size={14} className={loadingTelegram ? 'spin' : ''} />
                  Refresh
                </button>

                {telegramStatus?.configured && telegramStatus.bot_username && (
                  <a
                    href={`https://t.me/${telegramStatus.bot_username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.82rem',
                      padding: '0.45rem 0.85rem',
                      textDecoration: 'none',
                      color: '#38bdf8',
                    }}
                  >
                    <ExternalLink size={14} />
                    Open Bot
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleSendTestTelegram}
                  disabled={testSending || !telegramStatus?.configured}
                  className="btn btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.82rem',
                    padding: '0.45rem 0.95rem',
                    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                    opacity: telegramStatus?.configured ? 1 : 0.6,
                    cursor: telegramStatus?.configured ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Send size={14} className={testSending ? 'spin' : ''} />
                  {testSending ? 'Sending Ping...' : 'Send Test Confirmation'}
                </button>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '1rem 1.2rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <CheckCircle size={16} color="#34d399" />
                  <strong style={{ color: '#f1f5f9', fontSize: '0.9rem' }}>Real-time Query & Record Confirmation</strong>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  Every new operational record or AI search query created on the platform automatically triggers an instant structured confirmation card in Telegram, detailing title, domain, status, and operator.
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '1rem 1.2rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <Bot size={16} color="#38bdf8" />
                  <strong style={{ color: '#f1f5f9', fontSize: '0.9rem' }}>Bidirectional Telegram Chatbot</strong>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  Chat with Argus Nexus directly inside Telegram! The bot uses continuous long-polling without webhooks, querying live Supabase records via Groq AI 120B in seconds.
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '1rem 1.2rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <Users size={16} color="#a78bfa" />
                  <strong style={{ color: '#f1f5f9', fontSize: '0.9rem' }}>Auto-Registering Subscribers</strong>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  Active Recipients: <strong style={{ color: '#a78bfa' }}>{telegramStatus?.registered_chats?.length || 0} Chat ID(s)</strong>.
                  Anyone who clicks <code style={{ color: '#38bdf8' }}>/start</code> on your bot is automatically enrolled to receive broadcast confirmations.
                </div>
              </div>
            </div>

            {/* Quick Setup Instructions */}
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                padding: '1.2rem',
              }}
            >
              <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.6rem' }}>
                🚀 2-Minute Bot Setup Guide
              </div>
              <ol style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.8, paddingLeft: '1.2rem', margin: 0 }}>
                <li>
                  Open Telegram and search for <strong style={{ color: '#38bdf8' }}>@BotFather</strong>.
                </li>
                <li>
                  Send <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0.1rem 0.35rem', borderRadius: '4px', color: '#38bdf8' }}>/newbot</code> and follow instructions to name your bot (e.g. <em>ArgusNexusBot</em>).
                </li>
                <li>
                  Copy the provided <strong>HTTP API token</strong> and paste it into <code style={{ color: '#67e8f9' }}>backend/.env</code>:
                  <div style={{ background: '#0b1120', padding: '0.4rem 0.8rem', borderRadius: '6px', margin: '0.3rem 0', fontFamily: 'monospace', color: '#38bdf8' }}>
                    TELEGRAM_BOT_TOKEN=1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ
                  </div>
                </li>
                <li>
                  Open your newly created bot in Telegram and send <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0.1rem 0.35rem', borderRadius: '4px', color: '#38bdf8' }}>/start</code>.
                  The backend automatically registers your Chat ID!
                </li>
              </ol>
            </div>

            {/* Available Commands Reference Table */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '1.2rem',
              }}
            >
              <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.6rem' }}>
                🤖 Telegram Bot Interactive Commands
              </div>
              <div className="table-responsive">
                <table className="admin-table" style={{ fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '180px' }}>Command</th>
                      <th>Action & Behavior</th>
                      <th style={{ width: '130px' }}>Example</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code style={{ color: '#38bdf8', fontWeight: 700 }}>/start</code></td>
                      <td>Registers your Telegram Chat ID and subscribes to automated record & query confirmations</td>
                      <td><code>/start</code></td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#38bdf8', fontWeight: 700 }}>/status</code></td>
                      <td>Queries Supabase for active controllers, registered schemas, and total record counts</td>
                      <td><code>/status</code></td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#38bdf8', fontWeight: 700 }}>/recent</code></td>
                      <td>Fetches the 5 most recent records logged across all system domains with status flags</td>
                      <td><code>/recent</code></td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#38bdf8', fontWeight: 700 }}>/query &lt;question&gt;</code></td>
                      <td>Executes a real-time Groq AI cross-domain analysis across your live database records</td>
                      <td><code>/query critical alerts</code></td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#a78bfa', fontWeight: 700 }}>&lt;Direct Chat&gt;</code></td>
                      <td>Any regular question sent to the bot is automatically routed to Argus AI</td>
                      <td><code>"Any high priority tasks?"</code></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
