import React, { useState, useEffect } from 'react';
import { Shield, Sparkles, Cpu, Layers, CheckCircle2, Terminal } from 'lucide-react';

export default function NexusTransition({ userEmail, userName, onComplete }) {
  const [progress, setProgress] = useState(15);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { title: 'TELEGRAM & BIOMETRIC AUTH', detail: 'Token 0x8F94 verified • Zero-Trust Handshake OK', pct: 35 },
    { title: 'SYNCHRONIZING OPERATIONAL SCHEMAS', detail: 'Decrypting Industrial, Clinical & Asset Domains...', pct: 68 },
    { title: 'CALIBRATING GROQ 120B AI ENGINE', detail: 'Establishing cross-domain contextual vector index...', pct: 90 },
    { title: 'ACCESS GRANTED', detail: `Welcome aboard, Operator ${userName || userEmail?.split('@')[0] || ''}!`, pct: 100 },
  ];

  useEffect(() => {
    // Step 0 -> Step 1 at 500ms
    const t1 = setTimeout(() => {
      setCurrentStep(1);
      setProgress(68);
    }, 650);

    // Step 1 -> Step 2 at 1300ms
    const t2 = setTimeout(() => {
      setCurrentStep(2);
      setProgress(90);
    }, 1350);

    // Step 2 -> Step 3 at 2000ms
    const t3 = setTimeout(() => {
      setCurrentStep(3);
      setProgress(100);
    }, 2050);

    // Transition complete at 2800ms
    const t4 = setTimeout(() => {
      if (onComplete) onComplete();
    }, 2850);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  return (
    <div className="nexus-warp-portal">
      {/* Background Matrix Starfield Grid */}
      <div className="warp-grid-bg"></div>
      <div className="warp-laser-beam"></div>

      <div className="nexus-warp-content">
        {/* Central Quantum Holographic Shield */}
        <div className="warp-shield-wrap">
          <div className="warp-core-ring ring-outer"></div>
          <div className="warp-core-ring ring-mid"></div>
          <div className="warp-core-ring ring-inner"></div>
          <div className="warp-shield-box">
            <Shield size={44} className="warp-shield-icon" />
          </div>
        </div>

        {/* Brand Headline */}
        <div className="warp-brand-text">
          <div className="warp-pill-badge">
            <span className="warp-ping-dot"></span>
            INITIALIZING ARGUS NEXUS OPERATIONAL GATEWAY
          </div>
          <h1 className="warp-main-title">
            Connecting to <span className="warp-cyan">Nexus</span>
          </h1>
          <p className="warp-operator-tag">
            OPERATOR: <strong className="text-cyan">{userName || userEmail}</strong>
          </p>
        </div>

        {/* Real-time Telemetry Tele-type Box */}
        <div className="warp-telemetry-box">
          <div className="telemetry-header">
            <Terminal size={14} className="text-cyan" />
            <span>SYSTEM INITIALIZATION LOGS</span>
            <span className="telemetry-pct">{progress}%</span>
          </div>
          <div className="telemetry-body">
            <div className="telemetry-line active">
              <span className="telemetry-arrow">›</span>
              <span className="telemetry-step-title">{steps[currentStep].title}:</span>{' '}
              <span className="telemetry-step-detail">{steps[currentStep].detail}</span>
            </div>
          </div>
        </div>

        {/* Laser Energy Progress Bar */}
        <div className="warp-progress-track">
          <div
            className="warp-progress-fill"
            style={{ width: `${progress}%` }}
          >
            <div className="warp-progress-laser-head"></div>
          </div>
        </div>

        {/* System Handshake Badges */}
        <div className="warp-domains-row">
          <div className={`warp-domain-chip ${progress >= 35 ? 'active' : ''}`}>
            <span className="chip-dot"></span>
            Security Core
          </div>
          <div className={`warp-domain-chip ${progress >= 68 ? 'active' : ''}`}>
            <span className="chip-dot"></span>
            Schema Engine
          </div>
          <div className={`warp-domain-chip ${progress >= 90 ? 'active' : ''}`}>
            <span className="chip-dot"></span>
            Database Synced
          </div>
          <div className={`warp-domain-chip ${progress >= 100 ? 'active' : ''}`}>
            <span className="chip-dot"></span>
            AI Gateway
          </div>
        </div>
      </div>
    </div>
  );
}
