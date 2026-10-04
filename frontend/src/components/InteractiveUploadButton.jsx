import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Check, FileText, X, ExternalLink, Paperclip } from 'lucide-react';

export default function InteractiveUploadButton({
  onFileSelect,
  fileUrls = [],
  onRemoveFile,
  accept = "*/*"
}) {
  const [uploadState, setUploadState] = useState('idle'); // 'idle' | 'uploading' | 'completed'
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);
  const progressIntervalRef = useRef(null);

  // SVG Circle Geometry
  const size = 96; // 96px circular button
  const strokeWidth = 5;
  const center = size / 2;
  const radius = center - strokeWidth * 2;
  const circumference = 2 * Math.PI * radius;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const handleClick = () => {
    if (uploadState === 'uploading') return;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleInputChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    startUploadAnimation(file);
  };

  const startUploadAnimation = (file) => {
    setUploadState('uploading');
    setProgress(0);

    // Smooth clockwise filling progress ring over ~2 seconds
    const duration = 2000;
    const intervalTime = 30;
    const step = 100 / (duration / intervalTime);

    let currentProgress = 0;
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    progressIntervalRef.current = setInterval(() => {
      currentProgress += step;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(progressIntervalRef.current);
        setProgress(100);

        // Transition to Completion state
        setTimeout(() => {
          setUploadState('completed');
          if (onFileSelect) {
            onFileSelect(file);
          }

          // Reset to idle after 2.5s for further uploads
          setTimeout(() => {
            setUploadState('idle');
            setProgress(0);
            setFileName('');
          }, 2400);
        }, 200);
      } else {
        setProgress(Math.min(99, Math.round(currentProgress)));
      }
    }, intervalTime);
  };

  const strokeDashoffset = circumference - (circumference * progress) / 100;

  return (
    <div className="interactive-upload-wrapper">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleInputChange}
        accept={accept}
        style={{ display: 'none' }}
      />

      <div className="interactive-upload-container">
        {/* The Main Circular Upload Button Arena */}
        <div
          className={`interactive-upload-circle ${uploadState}`}
          onClick={handleClick}
          title={uploadState === 'idle' ? 'Click to upload files' : ''}
        >
          {/* Background SVG Progress Ring */}
          <svg className="upload-progress-svg" width={size} height={size}>
            <defs>
              <linearGradient id="blueGlowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Base Background Track Ring */}
            <circle
              className="track-ring"
              cx={center}
              cy={center}
              r={radius}
              strokeWidth={strokeWidth}
            />

            {/* Dynamic Clockwise Filling Blue Progress Ring */}
            <circle
              className={`progress-ring ${uploadState}`}
              cx={center}
              cy={center}
              r={radius}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={uploadState === 'completed' ? 0 : strokeDashoffset}
              filter={uploadState === 'uploading' ? 'url(#glowFilter)' : undefined}
            />
          </svg>

          {/* Center Inner Circle */}
          <div className="upload-inner-core">
            {uploadState === 'completed' ? (
              /* Completion State: Green Checkmark */
              <div className="upload-icon-success">
                <Check size={36} strokeWidth={3} className="check-svg-animate" />
              </div>
            ) : (
              /* Initial & Uploading State: White Upward Arrow */
              <div className={`upload-icon-arrow ${uploadState === 'uploading' ? 'pulse-up' : ''}`}>
                <ArrowUp size={34} strokeWidth={2.6} className="arrow-svg" />
              </div>
            )}
          </div>

          {/* File Transfer Effect: Floating Document Icons */}
          {uploadState === 'uploading' && (
            <div className="floating-docs-arena">
              <div className="floating-doc doc-1">
                <FileText size={18} />
              </div>
              <div className="floating-doc doc-2">
                <FileText size={15} />
              </div>
              <div className="floating-doc doc-3">
                <FileText size={20} />
              </div>
              <div className="floating-doc doc-4">
                <FileText size={16} />
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Status Label Below Button */}
        <div className="interactive-upload-labels">
          {uploadState === 'idle' && (
            <div className="label-idle" onClick={handleClick}>
              <span className="label-action">Click to Upload Document</span>
              <span className="label-sub">Scans, Telemetry, PDF, Images up to 25MB</span>
            </div>
          )}

          {uploadState === 'uploading' && (
            <div className="label-uploading">
              <span className="label-percentage">{progress}% Transferred</span>
              <span className="label-filename">{fileName || 'Encrypting & syncing file...'}</span>
            </div>
          )}

          {uploadState === 'completed' && (
            <div className="label-completed">
              <span className="label-success-text">Upload Complete!</span>
              <span className="label-settled">File attached to record</span>
            </div>
          )}
        </div>
      </div>

      {/* Uploaded Files Chips Grid */}
      {fileUrls && fileUrls.length > 0 && (
        <div className="interactive-file-list">
          <div className="file-list-heading">
            <Paperclip size={14} />
            <span>Attached Files ({fileUrls.length})</span>
          </div>
          <div className="file-chips-grid">
            {fileUrls.map((url, idx) => {
              const displayTitle = url.startsWith('blob:')
                ? `Attached Document #${idx + 1}`
                : url.split('/').pop()?.split('?')[0] || `Attachment #${idx + 1}`;
              return (
                <div key={idx} className="interactive-file-chip">
                  <div className="chip-left">
                    <FileText size={16} className="chip-icon" />
                    <span className="chip-name" title={url}>{displayTitle}</span>
                  </div>
                  <div className="chip-actions">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="chip-link"
                      title="View file"
                    >
                      <ExternalLink size={14} />
                    </a>
                    {onRemoveFile && (
                      <button
                        type="button"
                        onClick={() => onRemoveFile(idx)}
                        className="chip-remove"
                        title="Remove file"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
