import React, { useState } from 'react';
import { Sparkles, Edit2, Trash2, Calendar, User, FileText, CheckCircle, AlertTriangle, Clock, Search, Eye, History, X, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function EntityCards({
  records,
  schema,
  onEdit,
  onDelete,
  onRefresh,
}) {
  const { user, role } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [summarizingId, setSummarizingId] = useState(null);
  const [summaries, setSummaries] = useState({});
  const [selectedDetailRecord, setSelectedDetailRecord] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [loadingAuditTrail, setLoadingAuditTrail] = useState(false);

  const handleViewDetails = async (record) => {
    setSelectedDetailRecord(record);
    setAuditTrail([]);
    setLoadingAuditTrail(true);
    try {
      const res = await api.get(`/api/entities/${schema.entity_name}/${record.id}`);
      if (res.data?.audit_trail) {
        setAuditTrail(res.data.audit_trail);
      }
    } catch (e) {
      console.warn('Could not fetch audit trail:', e.message);
    } finally {
      setLoadingAuditTrail(false);
    }
  };

  const handleQuickStatus = async (record, newStatus) => {
    try {
      await api.put(`/api/entities/${schema.entity_name}/${record.id}`, {
        status: newStatus,
      });
      onRefresh();
    } catch (err) {
      console.warn('Quick status update failed:', err.message);
    }
  };

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(r.data || {}).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleGenerateSummary = async (record) => {
    setSummarizingId(record.id);
    try {
      const res = await api.post('/api/ai/summarize', {
        entity_name: schema.entity_name,
        record_id: record.id,
        title: record.title,
        data: record.data,
        file_urls: record.file_urls || [],
      });

      const summaryText = res.data.summary;
      setSummaries((prev) => ({ ...prev, [record.id]: summaryText }));
    } catch (err) {
      alert(`AI Briefing failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setSummarizingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'critical':
        return <span className="status-badge critical"><AlertTriangle size={12} /> CRITICAL</span>;
      case 'pending':
        return <span className="status-badge pending"><Clock size={12} /> PENDING</span>;
      case 'resolved':
        return <span className="status-badge resolved"><CheckCircle size={12} /> RESOLVED</span>;
      default:
        return <span className="status-badge active">ACTIVE</span>;
    }
  };

  return (
    <div className="cards-wrapper">
      {/* Search & Filter Header */}
      <div className="cards-toolbar">
        <div className="search-bar">
          <Search size={18} className="search-icon" aria-hidden="true" />
          <input
            type="text"
            placeholder={`Search ${schema.display_name.toLowerCase()} by title, keywords or values...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label={`Search ${schema.display_name} records by title or attributes`}
          />
        </div>

        <div className="filter-group">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter records by operational status"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="critical">Critical</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      {filteredRecords.length === 0 ? (
        <div className="empty-state" role="status">
          <FileText size={48} className="empty-icon" aria-hidden="true" />
          <h4>No records found</h4>
          <p>Create the first entry using the button above or adjust your search.</p>
        </div>
      ) : (
        <div className="cards-grid">
          {filteredRecords.map((r) => {
            const isOwner = user && r.owner_id === user.id;
            const canModify = role === 'admin' || isOwner;
            const activeSummary = summaries[r.id] || r.ai_summary;

            return (
              <article key={r.id} className="entity-card" aria-labelledby={`card-title-${r.id}`}>
                <div className="card-top">
                  <div className="card-header-line">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {getStatusBadge(r.status)}
                      {canModify && (
                        <select
                          value={r.status || 'active'}
                          onChange={(e) => handleQuickStatus(r, e.target.value)}
                          className="quick-status-select"
                          aria-label={`Update status for ${r.title}`}
                          title="Quick Change Status"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: 'var(--text-muted)',
                            fontSize: '0.72rem',
                            borderRadius: '6px',
                            padding: '0.15rem 0.3rem',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="active">Active</option>
                          <option value="pending">Pending</option>
                          <option value="critical">Critical</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      )}
                    </div>
                    <div className="card-actions">
                      <button
                        type="button"
                        onClick={() => handleViewDetails(r)}
                        className="btn-icon-subtle"
                        aria-label={`View details and audit trail for ${r.title}`}
                        title="View Full Details & Audit Trail"
                      >
                        <Eye size={15} aria-hidden="true" />
                      </button>
                      {canModify && (
                        <>
                          <button
                            type="button"
                            onClick={() => onEdit(r)}
                            className="btn-icon-subtle"
                            aria-label={`Edit record ${r.title}`}
                            title="Edit Record"
                          >
                            <Edit2 size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(r.id)}
                            className="btn-icon-subtle danger"
                            aria-label={`Delete record ${r.title}`}
                            title="Delete Record"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <h3 id={`card-title-${r.id}`} className="card-title">{r.title}</h3>
                </div>

                {/* Structured Dynamic Data Fields */}
                <div className="card-attributes">
                  {(schema.fields || []).map((f) => {
                    const val = r.data?.[f.name];
                    if (val === undefined || val === null || val === '') return null;

                    return (
                      <div key={f.name} className="attr-row">
                        <span className="attr-label">{f.label}:</span>
                        <span className="attr-val">
                          {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Attachments */}
                {r.file_urls && r.file_urls.length > 0 && (
                  <div className="card-attachments">
                    <span className="attach-title">Attachments:</span>
                    {r.file_urls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="attach-link"
                      >
                        Doc #{i + 1}
                      </a>
                    ))}
                  </div>
                )}

                {/* Groq AI Briefing & Document Analysis Box */}
                {activeSummary ? (
                  <div className="ai-summary-card">
                    <div className="ai-summary-header">
                      <div className="ai-header-left">
                        <Sparkles size={14} className="sparkle-icon" />
                        <span className="ai-header-title">AI Executive Briefing</span>
                        {r.file_urls && r.file_urls.length > 0 && (
                          <span className="doc-analyzed-badge" title="Attached document inspected & analyzed by Groq AI">
                            <FileText size={11} /> Doc Analyzed
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleGenerateSummary(r)}
                        disabled={summarizingId === r.id}
                        className="btn-reanalyze"
                        title="Re-run AI Document Analysis & Briefing"
                      >
                        <RefreshCw size={12} className={summarizingId === r.id ? 'spin' : ''} />
                        <span>{summarizingId === r.id ? 'Analyzing...' : 'Re-analyze'}</span>
                      </button>
                    </div>
                    <div className="ai-summary-text-formatted">
                      {activeSummary.split('\n\n').map((paragraph, pIdx) => {
                        if (paragraph.startsWith('### ')) {
                          return (
                            <div key={pIdx} className="ai-brief-section-title">
                              {paragraph.replace('### ', '')}
                            </div>
                          );
                        }
                        return <p key={pIdx}>{paragraph}</p>;
                      })}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleGenerateSummary(r)}
                    disabled={summarizingId === r.id}
                    className="btn btn-ai-summary"
                  >
                    <Sparkles size={14} />
                    <span>
                      {summarizingId === r.id
                        ? 'Analyzing Record & Documents...'
                        : r.file_urls && r.file_urls.length > 0
                        ? 'Generate AI Briefing & Analyze Doc'
                        : 'Generate AI Briefing'}
                    </span>
                  </button>
                )}

                {/* Card Footer: Metadata */}
                <div className="card-footer">
                  <div className="meta-item">
                    <Calendar size={13} />
                    <span>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  {r.profiles && (
                    <div className="meta-item">
                      <User size={13} />
                      <span>{r.profiles.full_name || r.profiles.email}</span>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Record Details & Immutable Audit Trail Modal */}
      {selectedDetailRecord && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card modal-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-modal-title"
            style={{ maxWidth: '780px' }}
          >
            <div className="modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                  {getStatusBadge(selectedDetailRecord.status)}
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    ID: <code>{selectedDetailRecord.id}</code>
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{selectedDetailRecord.title}</h3>
              </div>
              <button onClick={() => setSelectedDetailRecord(null)} className="btn-close">
                <X size={20} />
              </button>
            </div>

            <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {/* AI Executive Briefing Highlight */}
              {(summaries[selectedDetailRecord.id] || selectedDetailRecord.ai_summary) && (
                <div className="ai-summary-card" style={{ marginBottom: '1.25rem' }}>
                  <div className="ai-summary-header">
                    <div className="ai-header-left">
                      <Sparkles size={14} className="sparkle-icon" />
                      <span className="ai-header-title">Groq AI Executive Briefing</span>
                      {selectedDetailRecord.file_urls && selectedDetailRecord.file_urls.length > 0 && (
                        <span className="doc-analyzed-badge">
                          <FileText size={11} /> Document Deep Dive Included
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ai-summary-text-formatted">
                    {(summaries[selectedDetailRecord.id] || selectedDetailRecord.ai_summary)
                      .split('\n\n')
                      .map((paragraph, pIdx) => {
                        if (paragraph.startsWith('### ')) {
                          return (
                            <div key={pIdx} className="ai-brief-section-title">
                              {paragraph.replace('### ', '')}
                            </div>
                          );
                        }
                        return <p key={pIdx}>{paragraph}</p>;
                      })}
                  </div>
                </div>
              )}

              {/* Data Fields */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--accent-cyan)' }}>
                  Domain Attributes ({schema.display_name})
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '1rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                  {(schema.fields || []).map((f) => {
                    const val = selectedDetailRecord.data?.[f.name];
                    return (
                      <div key={f.name}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          {f.label}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#fff', marginTop: '0.15rem' }}>
                          {val !== undefined && val !== null && val !== '' ? String(val) : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* File Attachments */}
              {selectedDetailRecord.file_urls && selectedDetailRecord.file_urls.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: 'var(--accent-cyan)' }}>
                    Attached Documentation ({selectedDetailRecord.file_urls.length})
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {selectedDetailRecord.file_urls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="attach-link"
                        style={{ padding: '0.35rem 0.75rem' }}
                      >
                        Attachment #{i + 1} (Click to View)
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Immutable Audit Trail Timeline */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                  <History size={16} style={{ color: 'var(--accent-cyan)' }} />
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--accent-cyan)' }}>
                    Immutable Record Audit Trail
                  </h4>
                </div>

                {loadingAuditTrail ? (
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                    Loading compliance history...
                  </div>
                ) : auditTrail.length === 0 ? (
                  <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No prior edits recorded. Initial creation logged at {new Date(selectedDetailRecord.created_at).toLocaleString()}.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {auditTrail.map((log) => (
                      <div
                        key={log.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.6rem 0.85rem',
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          fontSize: '0.85rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span className={`audit-action-pill ${log.action?.toLowerCase()}`}>
                            {log.action}
                          </span>
                          <span>by <strong>{log.profiles?.full_name || log.profiles?.email || 'System'}</strong></span>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="form-footer" style={{ marginTop: '1.25rem', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setSelectedDetailRecord(null)}
                className="btn btn-secondary"
              >
                Close
              </button>
              {canModify && (
                <button
                  type="button"
                  onClick={() => {
                    const rec = selectedDetailRecord;
                    setSelectedDetailRecord(null);
                    onEdit(rec);
                  }}
                  className="btn btn-primary"
                >
                  <Edit2 size={15} /> Edit Record
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
