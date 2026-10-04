import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import InteractiveUploadButton from './InteractiveUploadButton';
import { supabase, isSupabaseConfigured } from '../supabase';
import api from '../api';

export default function DynamicForm({
  isOpen,
  onClose,
  schema,
  initialData = null,
  onSubmit,
}) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('active');
  const [formData, setFormData] = useState({});
  const [fileUrls, setFileUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setStatus(initialData.status || 'active');
      setFormData(initialData.data || {});
      setFileUrls(initialData.file_urls || []);
    } else {
      setTitle('');
      setStatus('active');
      setFormData({});
      setFileUrls([]);
    }
    setError('');
  }, [initialData, schema, isOpen]);

  if (!isOpen || !schema) return null;

  const handleFieldChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileAttach = async (file) => {
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      // 1. Upload via Backend Upload API
      const bodyFormData = new FormData();
      bodyFormData.append('file', file);
      const res = await api.post('/api/upload', bodyFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.url) {
        setFileUrls((prev) => [...prev, res.data.url]);
        setUploading(false);
        return;
      }
    } catch (apiErr) {
      console.warn('Backend upload bypassed, falling back:', apiErr.message);
    }

    try {
      // 2. Direct Supabase Storage
      if (isSupabaseConfigured()) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${schema.entity_name}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(filePath, file);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('uploads')
            .getPublicUrl(filePath);

          setFileUrls((prev) => [...prev, urlData.publicUrl]);
          setUploading(false);
          return;
        }
      }
      // 3. Offline Blob URL fallback
      const simulatedUrl = URL.createObjectURL(file);
      setFileUrls((prev) => [...prev, simulatedUrl]);
    } catch (err) {
      const simulatedUrl = URL.createObjectURL(file);
      setFileUrls((prev) => [...prev, simulatedUrl]);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = (indexToRemove) => {
    setFileUrls((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please provide a title or primary headline.');
      return;
    }

    // Check required fields
    for (const field of schema.fields || []) {
      if (field.required && !formData[field.name]) {
        setError(`"${field.label}" is required.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        status,
        data: formData,
        file_urls: fileUrls,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Error saving record');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card modal-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-modal-title"
      >
        <div className="modal-header">
          <div>
            <h3 id="form-modal-title">
              {initialData ? `Edit ${schema.display_name}` : `Create New ${schema.display_name}`}
            </h3>
            <p className="modal-desc">{schema.description || 'Fill in the fields below'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-close"
            aria-label="Close form modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div className="error-alert" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="dynamic-form">
          {/* Universal Title Field */}
          <div className="form-group">
            <label htmlFor="record-title">
              Record Title / Identifier <span className="req">*</span>
            </label>
            <input
              id="record-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Critical Turbine Overheat / Patient John Doe Intake"
              required
              aria-required="true"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="record-status">Status</label>
              <select
                id="record-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="active">Active</option>
                <option value="pending">Pending Review</option>
                <option value="critical">Critical / Urgent</option>
                <option value="resolved">Resolved / Completed</option>
              </select>
            </div>
          </div>

          {/* Dynamic Schema Fields */}
          <div className="dynamic-fields-grid">
            {(schema.fields || []).map((f) => {
              const val = formData[f.name] ?? '';
              const fieldId = `dyn-field-${f.name}`;

              return (
                <div key={f.name} className={`form-group ${f.type === 'textarea' ? 'span-full' : ''}`}>
                  <label htmlFor={fieldId}>
                    {f.label} {f.required && <span className="req">*</span>}
                  </label>

                  {f.type === 'select' ? (
                    <select
                      id={fieldId}
                      value={val}
                      onChange={(e) => handleFieldChange(f.name, e.target.value)}
                      required={f.required}
                      aria-required={f.required}
                    >
                      <option value="">-- Select {f.label} --</option>
                      {(f.options || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      id={fieldId}
                      rows={4}
                      value={val}
                      onChange={(e) => handleFieldChange(f.name, e.target.value)}
                      placeholder={`Enter ${f.label.toLowerCase()}...`}
                      required={f.required}
                      aria-required={f.required}
                    />
                  ) : (
                    <input
                      id={fieldId}
                      type={f.type || 'text'}
                      value={val}
                      onChange={(e) => handleFieldChange(f.name, e.target.value)}
                      placeholder={`Enter ${f.label.toLowerCase()}...`}
                      required={f.required}
                      aria-required={f.required}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Interactive Circular Upload Button Section */}
          <div className="form-group span-full file-upload-box">
            <label htmlFor="file-attachment-section">Attachments (Scans, Documents, Photos, Reports)</label>
            <div id="file-attachment-section">
              <InteractiveUploadButton
                onFileSelect={handleFileAttach}
                fileUrls={fileUrls}
                onRemoveFile={handleRemoveFile}
              />
            </div>
          </div>

          <div className="form-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary" aria-busy={submitting}>
              <Save size={16} aria-hidden="true" />
              <span>{submitting ? 'Saving...' : initialData ? 'Update Record' : 'Save Record'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
