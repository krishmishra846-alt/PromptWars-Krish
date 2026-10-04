import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import OTPVerificationV3 from './OTPVerificationV3';
import NexusTransition from './NexusTransition';
import './LampLogin.css';
import {
  Shield, Lock, Mail, User, Eye, EyeOff,
  ShieldAlert, Loader2, ArrowRight,
  Check, Phone, Power
} from 'lucide-react';

export default function LoginPage() {
  const { login, register, loginWithGoogle, loginAdminFixed } = useAuth();

  // Lamp State: Initial state is OFF (darkness)
  const [isLampOn, setIsLampOn] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);

  // Form Fields: Username, Email Address, Password
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Portal Mode: 'user' | 'admin'
  const [authMode, setAuthMode] = useState('user');
  // User sub-tab: 'login' | 'register'
  const [userTab, setUserTab] = useState('login');

  // Registration Extra Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [honeypot, setHoneypot] = useState('');

  // Status & Feedback
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Runaway Dodging Button State
  const [buttonOffset, setButtonOffset] = useState({ x: 0, y: 0 });

  // OTP Verification Modal & Nexus Warp Portal
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('4719');
  const [showConnectingPortal, setShowConnectingPortal] = useState(false);

  // Canvas Ref for Floating Dust Particles
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animationFrameRef = useRef(null);
  const pullStartYRef = useRef(null);

  // -------------------------------------------------------------
  // Calculate Field Completion & Runaway Stages
  // -------------------------------------------------------------
  const { filledStage, missingCount, isAllFilled } = useMemo(() => {
    if (authMode === 'admin') {
      const idFilled = username.trim().length > 0 || email.trim().length > 0;
      const passFilled = password.trim().length > 0;
      const total = 2;
      const count = (idFilled ? 1 : 0) + (passFilled ? 1 : 0);
      return {
        filledStage: count === total ? 2 : count === 1 ? 1 : 0,
        missingCount: total - count,
        isAllFilled: count === total,
      };
    }

    if (userTab === 'register') {
      const uFilled = username.trim().length >= 3;
      const pFilled = phone.replace(/\D/g, '').length === 10;
      const eFilled = email.trim().length > 0 && email.includes('@');
      const pwFilled = password.trim().length >= 6;
      const total = 4;
      const count = (uFilled ? 1 : 0) + (pFilled ? 1 : 0) + (eFilled ? 1 : 0) + (pwFilled ? 1 : 0);
      return {
        filledStage: count === total ? 2 : count >= 2 ? 1 : 0,
        missingCount: total - count,
        isAllFilled: count === total,
      };
    }

    // Standard User Login: Identifier (Username/Email/Mobile No) and Password
    const idFilled = username.trim().length > 0 || email.trim().length > 0;
    const pwFilled = password.trim().length > 0;
    const total = 2;
    const count = (idFilled ? 1 : 0) + (pwFilled ? 1 : 0);

    return {
      filledStage: count === total ? 2 : count === 1 ? 1 : 0,
      missingCount: total - count,
      isAllFilled: count === total,
    };
  }, [authMode, userTab, username, phone, email, password]);

  // Evasion Handler: runs on mouseEnter/mouseMove until all info is filled!
  const handleButtonDodge = () => {
    if (isAllFilled || loading) {
      return;
    }

    // Determine evasion intensity based on stage
    if (filledStage === 0) {
      // Stage 0: Wild & Fast Dodge
      const dirX = Math.random() > 0.5 ? 1 : -1;
      const dirY = Math.random() > 0.5 ? 1 : -1;
      const jumpX = dirX * (55 + Math.floor(Math.random() * 35));
      const jumpY = dirY * (22 + Math.floor(Math.random() * 18));
      setButtonOffset({ x: jumpX, y: jumpY });
    } else {
      // Stage 1: Slowing down (almost there)
      const dirX = Math.random() > 0.5 ? 1 : -1;
      const dirY = Math.random() > 0.5 ? 1 : -1;
      const jumpX = dirX * (28 + Math.floor(Math.random() * 20));
      const jumpY = dirY * (12 + Math.floor(Math.random() * 10));
      setButtonOffset({ x: jumpX, y: jumpY });
    }
  };

  // Dynamic Runaway Caption Text
  const captionInfo = useMemo(() => {
    if (loading) {
      return { text: 'Authenticating credentials...', className: 'stage-2' };
    }
    if (isAllFilled) {
      return { text: '✨ Locked in! Ready to enter.', className: 'stage-2' };
    }
    if (filledStage === 1) {
      return {
        text: `Almost there • ${missingCount} field${missingCount > 1 ? 's' : ''} left (slowing down...)`,
        className: 'stage-1'
      };
    }
    return {
      text: `Fill all info before the button stands still (${missingCount} missing)`,
      className: 'stage-0'
    };
  }, [loading, isAllFilled, filledStage, missingCount]);

  // -------------------------------------------------------------
  // Synthesized Mechanical Pull-Cord Switch Click (Web Audio API)
  // -------------------------------------------------------------
  const playPullCordClick = useCallback((turningOn) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;

      // Primary crisp mechanical latch toggle
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(turningOn ? 380 : 310, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.04);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);

      // Metallic spring harmonic release
      const springOsc = ctx.createOscillator();
      const springGain = ctx.createGain();
      springOsc.type = 'sine';
      springOsc.frequency.setValueAtTime(turningOn ? 920 : 760, now + 0.015);
      springOsc.frequency.exponentialRampToValueAtTime(240, now + 0.12);
      springGain.gain.setValueAtTime(0.09, now + 0.015);
      springGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      springOsc.connect(springGain);
      springGain.connect(ctx.destination);
      springOsc.start(now + 0.015);
      springOsc.stop(now + 0.13);
    } catch {
      // Audio playback fails gracefully if browser blocks before user gesture
    }
  }, []);

  // Toggle Lamp with Cord Physics & Click Audio
  const triggerLampToggle = useCallback(() => {
    const nextState = !isLampOn;
    playPullCordClick(nextState);
    setIsLampOn(nextState);

    // Trigger visual spring recoil
    setIsSnapping(true);
    setPullY(0);
    setIsPulling(false);
    setTimeout(() => {
      setIsSnapping(false);
    }, 500);
  }, [isLampOn, playPullCordClick]);

  // Click & Drag Handlers for the Lamp Switch
  const handleSwitchClick = (e) => {
    e.stopPropagation();
    setPullY(26);
    setTimeout(() => {
      triggerLampToggle();
    }, 130);
  };

  const handleSwitchMouseDown = (e) => {
    e.preventDefault();
    setIsPulling(true);
    pullStartYRef.current = e.clientY;

    const onMouseMove = (moveEvent) => {
      if (pullStartYRef.current === null) return;
      const deltaY = Math.max(0, Math.min(36, moveEvent.clientY - pullStartYRef.current));
      setPullY(deltaY);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      pullStartYRef.current = null;
      triggerLampToggle();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleSwitchTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    setIsPulling(true);
    pullStartYRef.current = e.touches[0].clientY;

    const onTouchMove = (moveEvent) => {
      if (pullStartYRef.current === null) return;
      const deltaY = Math.max(0, Math.min(36, moveEvent.touches[0].clientY - pullStartYRef.current));
      setPullY(deltaY);
    };

    const onTouchEnd = () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      pullStartYRef.current = null;
      triggerLampToggle();
    };

    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
  };

  const handleSwitchKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSwitchClick(e);
    }
  };

  // -------------------------------------------------------------
  // Floating Dust Particles with Silky Interpolated Fade
  // -------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particleCount = 55;
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * (width * 0.7) + width * 0.15,
        y: Math.random() * (height * 0.7) + height * 0.12,
        radius: Math.random() * 2.2 + 0.8,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -(Math.random() * 0.45 + 0.15),
        alpha: Math.random() * 0.65 + 0.25,
        twinkleSpeed: Math.random() * 0.03 + 0.015,
        angle: Math.random() * Math.PI * 2,
      });
    }
    particlesRef.current = particles;

    let currentAlpha = isLampOn ? 1.0 : 0.0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Silky smooth exponential lerp towards target
      const targetAlpha = isLampOn ? 1.0 : 0.0;
      currentAlpha += (targetAlpha - currentAlpha) * 0.08;

      if (currentAlpha > 0.005) {
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.angle += p.twinkleSpeed;
          p.x += p.vx + Math.sin(p.angle) * 0.25;
          p.y += p.vy;

          if (p.y < height * 0.1) p.y = height * 0.85;
          if (p.x < width * 0.12) p.x = width * 0.85;
          if (p.x > width * 0.88) p.x = width * 0.15;

          const opacity = (p.alpha * (0.65 + 0.35 * Math.sin(p.angle))) * currentAlpha;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 238, 160, ${opacity})`;
          ctx.shadowBlur = 8;
          ctx.shadowColor = 'rgba(251, 191, 36, 0.75)';
          ctx.fill();
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isLampOn]);

  // Form Submit Handler
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!isAllFilled || loading) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (authMode === 'admin') {
        const adminIdentifier = email || username;
        if (!adminIdentifier || !password) {
          throw new Error('Please enter master admin ID and password.');
        }
        await loginAdminFixed(adminIdentifier, password);
        setSuccess('Master Admin authenticated. Connecting to Command Console...');
        setShowConnectingPortal(true);
      } else if (userTab === 'login') {
        const identifier = username.trim() || email.trim();
        if (!identifier || !password) {
          throw new Error('Please enter your Username, Mobile No, or Email and Password.');
        }
        await login(identifier, password);
        setSuccess('Authentication successful. Illuminating Nexus...');
        setShowConnectingPortal(true);
      } else {
        if (!username || username.trim().length < 3) {
          throw new Error('Please enter a username (at least 3 characters).');
        }
        if (!email || !password) {
          throw new Error('Please fill in email and password.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }

        const cleanPhone = phone.replace(/\D/g, '');
        if (!cleanPhone || cleanPhone.length !== 10) {
          throw new Error('Please enter a valid 10-digit mobile number to receive your Telegram OTP.');
        }

        try {
          const res = await api.post('/api/auth/send-otp', {
            email,
            username: username.trim().toLowerCase(),
            full_name: fullName || username || 'New Operator',
            phone: cleanPhone,
            website_hp: honeypot || undefined,
          });
          if (res.data?.code) {
            setGeneratedOtp(res.data.code);
          }
        } catch (otpErr) {
          const errMsg = otpErr.response?.data?.detail || otpErr.message;
          throw new Error(errMsg);
        }

        setLoading(false);
        setShowOtpModal(true);
        return;
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Callback when OTP verification succeeds
  const handleOtpSuccess = async () => {
    setShowOtpModal(false);
    setShowConnectingPortal(true);
    try {
      await register(
        email,
        password,
        fullName || username,
        '',
        phone.replace(/\D/g, ''),
        username.trim().toLowerCase()
      );
      setSuccess('🎉 Registration verified! Welcome to Argus Nexus.');
    } catch (err) {
      console.error('Registration finish error:', err);
    }
  };

  // Google OAuth Login
  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      setSuccess('Connecting to Google Identity...');
    } catch (err) {
      setError(`Google Sign-In: ${err.message || 'Please verify Google Provider settings or use Email.'}`);
      setLoading(false);
    }
  };

  // Cinematic Nexus Connection Warp Sequence
  if (showConnectingPortal) {
    return (
      <NexusTransition
        userEmail={email}
        userName={username || fullName || (authMode === 'admin' ? 'Master Admin' : 'Operator')}
        onComplete={() => {
          setShowConnectingPortal(false);
        }}
      />
    );
  }

  return (
    <div className={`lamp-room-viewport ${isLampOn ? 'lamp-on' : ''}`}>
      {/* Perspective Ground / Floor Horizon */}
      <div className="lamp-room-floor" aria-hidden="true"></div>

      {/* Warm Ambient Bloom when lamp is lit */}
      <div className="lamp-ambient-bloom" aria-hidden="true"></div>

      {/* Warm Elliptical Pool of Light on Floor */}
      <div className="lamp-floor-glow" aria-hidden="true"></div>

      {/* Volumetric Cone of Warm Yellow Light radiating to the right */}
      <div className="lamp-light-cone-container" aria-hidden="true">
        <div className="lamp-light-cone"></div>
        <div className="lamp-light-cone-core"></div>
      </div>

      {/* Floating Glowing Dust Particles Canvas */}
      <canvas ref={canvasRef} className="lamp-dust-canvas" aria-hidden="true"></canvas>

      {/* Main Interactive Stage */}
      <div className="lamp-stage">
        {/* ================================================================= */}
        {/* DIGITAL FLOOR LAMP WITH SILHOUETTE & DANGLING PULL SWITCH */}
        {/* ================================================================= */}
        <div className="lamp-container">
          <div className="lamp-base-shadow" aria-hidden="true"></div>

          <svg
            className="lamp-svg"
            viewBox="0 0 440 680"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Interactive digital floor lamp"
          >
            <defs>
              <linearGradient id="metalStemGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#1a1e28" />
                <stop offset="35%" stopColor="#374151" />
                <stop offset="70%" stopColor="#4b5563" />
                <stop offset="100%" stopColor="#111827" />
              </linearGradient>

              <filter id="bulbGlowFilter" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur1" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="blur2" />
                <feMerge>
                  <feMergeNode in="blur2" />
                  <feMergeNode in="blur1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Lamp Base */}
            <ellipse cx="140" cy="635" rx="72" ry="15" className="lamp-base-bevel" />
            <ellipse cx="140" cy="632" rx="64" ry="12" fill="url(#metalStemGrad)" />

            {/* Vertical Main Stem */}
            <rect x="137" y="175" width="6" height="458" rx="3" fill="url(#metalStemGrad)" />

            {/* Cantilever Neck Arch reaching smoothly to the right */}
            <path
              d="M 140 178 C 140 92, 252 82, 252 118"
              fill="none"
              stroke="url(#metalStemGrad)"
              strokeWidth="6"
              strokeLinecap="round"
            />

            {/* Joint Knobs */}
            <circle cx="140" cy="178" r="6" fill="#374151" stroke="#4b5563" strokeWidth="1.5" />
            <circle cx="252" cy="118" r="6.5" fill="#d97706" stroke="#f59e0b" strokeWidth="1.5" />

            {/* Vertical Socket Extension Rod */}
            <line x1="252" y1="124" x2="252" y2="138" stroke="url(#metalStemGrad)" strokeWidth="4" />

            {/* Lampshade Head */}
            <g transform="rotate(8, 252, 140)">
              {/* Inner Warm Reflector */}
              <ellipse
                cx="252"
                cy="175"
                rx="42"
                ry="13"
                className="lamp-shade-inner"
              />

              {/* Incandescent Bulb inside shade */}
              <circle
                cx="252"
                cy="166"
                r="13"
                className="lamp-bulb"
                filter={isLampOn ? 'url(#bulbGlowFilter)' : undefined}
              />

              {/* Outer Lampshade Silhouette */}
              <path
                d="M 234 138 L 270 138 L 294 175 C 294 182, 210 182, 210 175 Z"
                className="lamp-shade-outer"
              />

              {/* Shade Bottom Metallic Rim */}
              <ellipse
                cx="252"
                cy="175"
                rx="42"
                ry="8"
                fill="none"
                stroke={isLampOn ? 'rgba(251, 191, 36, 0.6)' : 'rgba(255, 255, 255, 0.1)'}
                strokeWidth="1.5"
              />
            </g>

            {/* ============================================================= */}
            {/* INTERACTIVE DANGLING PULL SWITCH CORD (SILKY PHYSICS) */}
            {/* ============================================================= */}
            <g
              className={`lamp-pull-switch-group ${isPulling ? 'is-pulling' : ''} ${isSnapping ? 'snapping' : ''}`}
              onClick={handleSwitchClick}
              onMouseDown={handleSwitchMouseDown}
              onTouchStart={handleSwitchTouchStart}
              onKeyDown={handleSwitchKeyDown}
              role="button"
              tabIndex={0}
              aria-label={isLampOn ? 'Turn off floor lamp' : 'Turn on floor lamp'}
              aria-expanded={isLampOn}
              style={{
                transform: !isSnapping ? `translateY(${pullY}px)` : undefined,
              }}
            >
              <line
                x1="240"
                y1="172"
                x2="240"
                y2={290 + pullY}
                className="lamp-pull-chain"
              />

              <rect
                x="235"
                y={286 + pullY}
                width="10"
                height="22"
                rx="5"
                className="lamp-pull-bob"
              />

              <circle
                cx="240"
                cy={312 + pullY}
                r="3.5"
                className="lamp-pull-bob"
              />

              {/* Generous Hit Box for easy interactions */}
              <rect
                x="215"
                y="165"
                width="50"
                height={165 + pullY}
                fill="transparent"
                style={{ cursor: isPulling ? 'grabbing' : 'grab' }}
              />
            </g>
          </svg>

          {!isLampOn && (
            <div className="lamp-pull-hint" onClick={handleSwitchClick}>
              <Power size={13} />
              <span>Pull cord to turn on</span>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* THE REVEALED "WELCOME BACK" LOGIN FORM WITH RUNAWAY DODGE BUTTON */}
        {/* ================================================================= */}
        <div className="lamp-form-wrapper" aria-hidden={!isLampOn}>
          <div className="lamp-login-card">
            <div className="lamp-card-top-shine"></div>

            {/* Header with "Welcome Back" */}
            <div className="lamp-card-header">
              <div className="lamp-badge-row">
                <div className="lamp-status-badge">
                  <span className="lamp-pulse-dot"></span>
                  <span>ARGUS SYSTEM GATEWAY</span>
                </div>
                <Shield size={16} style={{ color: '#fbbf24' }} />
              </div>
              <h1 className="lamp-title">
                <span>Welcome</span> <span className="lamp-title-highlight">Back</span>
              </h1>
              <p className="lamp-subtitle">
                Please enter your credentials to access the operational console.
              </p>
            </div>

            {/* Role Switcher: Operator vs Master Admin */}
            <div className="lamp-role-tabs">
              <button
                type="button"
                className={`lamp-role-btn ${authMode === 'user' ? 'active' : ''}`}
                onClick={() => { setAuthMode('user'); setError(''); }}
              >
                <User size={13} />
                <span>Operator</span>
              </button>
              <button
                type="button"
                className={`lamp-role-btn admin ${authMode === 'admin' ? 'active' : ''}`}
                onClick={() => { setAuthMode('admin'); setError(''); }}
              >
                <ShieldAlert size={13} />
                <span>Master Admin</span>
              </button>
            </div>

            {/* Master Admin Dedicated Mode Notice */}
            {authMode === 'admin' && (
              <div className="lamp-admin-exclusive-note" style={{ marginBottom: '1.1rem' }}>
                <ShieldAlert size={15} style={{ flexShrink: 0, color: '#f59e0b' }} />
                <span>Single ID &amp; Password Access Only • Google Login is disabled for Master Admin</span>
              </div>
            )}

            {/* Operator Sub-tabs: Sign In vs Create Account */}
            {authMode === 'user' && (
              <div className="lamp-subtabs">
                <button
                  type="button"
                  className={`lamp-subtab-btn ${userTab === 'login' ? 'active' : ''}`}
                  onClick={() => { setUserTab('login'); setError(''); }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className={`lamp-subtab-btn ${userTab === 'register' ? 'active' : ''}`}
                  onClick={() => { setUserTab('register'); setError(''); }}
                >
                  Create account
                </button>
              </div>
            )}

            {/* Feedback Alerts */}
            {error && <div className="lamp-alert error">{error}</div>}
            {success && <div className="lamp-alert success">{success}</div>}

            {/* The Login Form: Username/Number/Email, Password, Register Fields */}
            <form onSubmit={handleSubmit} className="lamp-form">
              {authMode === 'admin' ? (
                <>
                  <div className="lamp-input-group">
                    <label htmlFor="lamp-admin-id">Master Admin ID</label>
                    <div className="lamp-input-wrap">
                      <ShieldAlert size={16} className="input-icon" />
                      <input
                        id="lamp-admin-id"
                        type="text"
                        value={username || email}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          setEmail(e.target.value);
                        }}
                        placeholder="admin@vibethon.ai"
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>
                </>
              ) : userTab === 'login' ? (
                <>
                  <div className="lamp-input-group">
                    <label htmlFor="lamp-login-id">Username, Mobile No, or Email</label>
                    <div className="lamp-input-wrap">
                      <User size={16} className="input-icon" />
                      <input
                        id="lamp-login-id"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. alex.rivers or 9876543210 or alex@argus.ai"
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Registration Mode: Unique Username, Full Name, Unique Phone, Unique Email */}
                  <div className="lamp-input-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label htmlFor="lamp-reg-username">Username</label>
                      <span style={{ fontSize: '0.7rem', color: username.trim().length >= 3 ? '#34d399' : '#fbbf24' }}>
                        Must be unique (min 3 chars)
                      </span>
                    </div>
                    <div className="lamp-input-wrap">
                      <User size={16} className="input-icon" />
                      <input
                        id="lamp-reg-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                        placeholder="e.g. alex_rivers"
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>

                  <div className="lamp-input-group">
                    <label htmlFor="lamp-fullname">Full Name (Optional)</label>
                    <div className="lamp-input-wrap">
                      <User size={16} className="input-icon" />
                      <input
                        id="lamp-fullname"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Alex Rivers"
                      />
                    </div>
                  </div>

                  <div className="lamp-input-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label htmlFor="lamp-phone">Mobile Number (10 Digits)</label>
                      <span style={{ fontSize: '0.7rem', color: phone.replace(/\D/g, '').length === 10 ? '#34d399' : '#fbbf24' }}>
                        Must be unique ({phone.replace(/\D/g, '').length}/10)
                      </span>
                    </div>
                    <div className="lamp-input-wrap">
                      <Phone size={16} className="input-icon" />
                      <input
                        id="lamp-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="e.g. 9876543210"
                        required
                      />
                    </div>
                  </div>

                  <div className="lamp-input-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label htmlFor="lamp-email">Email Address</label>
                      <span style={{ fontSize: '0.7rem', color: email.includes('@') ? '#34d399' : '#fbbf24' }}>
                        Must be unique
                      </span>
                    </div>
                    <div className="lamp-input-wrap">
                      <Mail size={16} className="input-icon" />
                      <input
                        id="lamp-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="alex@company.com"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  {/* Anti-Bot Honeypot Trap (Checklist Item #3: Bot Protection) */}
                  <div style={{ display: 'none', opacity: 0, position: 'absolute', left: '-9999px', pointerEvents: 'none' }} aria-hidden="true">
                    <label htmlFor="lamp-anti-bot">Security verification (Leave blank)</label>
                    <input
                      id="lamp-anti-bot"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Password Field (Common to all modes) */}
              <div className="lamp-input-group">
                <label htmlFor="lamp-password">Password</label>
                <div className="lamp-input-wrap">
                  <Lock size={16} className="input-icon" />
                  <input
                    id="lamp-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete={userTab === 'register' ? 'new-password' : 'current-password'}
                    required
                  />
                  <button
                    type="button"
                    className="lamp-pw-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="lamp-options-row">
                <label className="lamp-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="lamp-custom-check">
                    {rememberMe && <Check size={11} strokeWidth={3.5} />}
                  </span>
                  <span>Remember me</span>
                </label>
                <a href="#forgot" className="lamp-forgot-link" onClick={(e) => e.preventDefault()}>
                  Forgot password?
                </a>
              </div>

              {/* =========================================================== */}
              {/* RUNAWAY LOGIN BUTTON ARENA (RUNS AWAY UNTIL ALL INFO FILLED) */}
              {/* =========================================================== */}
              <div className="lamp-runaway-arena">
                <div
                  className="lamp-runaway-anchor"
                  onMouseEnter={handleButtonDodge}
                  onMouseMove={handleButtonDodge}
                >
                  <button
                    type="submit"
                    disabled={!isAllFilled || loading}
                    onClick={handleSubmit}
                    className={`lamp-runaway-btn stage-${filledStage} ${loading ? 'stage-submitting' : ''}`}
                    style={{
                      transform: isAllFilled
                        ? 'translate(0px, 0px)'
                        : `translate(${buttonOffset.x}px, ${buttonOffset.y}px)`,
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {authMode === 'admin'
                            ? 'Enter Command Console'
                            : userTab === 'login' ? 'Sign In' : 'Create Account'}
                        </span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>

                {/* Runaway Dynamic Feedback Caption */}
                <div className={`lamp-runaway-caption ${captionInfo.className}`}>
                  <span className="caption-pulse-dot" />
                  <span>{captionInfo.text}</span>
                </div>
              </div>
            </form>

            {/* For Standard Users: Show Google Sign-In and Admin Switch */}
            {authMode === 'user' ? (
              <>
                <div className="lamp-divider">
                  <span>OR CONNECT WITH</span>
                </div>

                <div className="lamp-social-grid">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="lamp-social-btn"
                    title="Continue with Google"
                  >
                    <svg className="social-svg" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('admin');
                      setError('');
                    }}
                    className="lamp-social-btn"
                    title="Switch to Master Admin"
                  >
                    <ShieldAlert size={16} style={{ color: '#fbbf24' }} />
                    <span>Admin Access</span>
                  </button>
                </div>
              </>
            ) : (
              /* For Master Admin: NO GOOGLE OPTION. Single ID & Password Only. */
              <div className="lamp-admin-exclusive-container">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('user');
                    setError('');
                  }}
                  className="lamp-return-user-btn"
                  title="Return to Standard User Portal"
                >
                  <User size={15} />
                  <span>Return to Standard User Portal</span>
                </button>
              </div>
            )}

            {/* Quick Helper to turn off lamp */}
            <div className="lamp-turnoff-hint" onClick={handleSwitchClick}>
              <Power size={12} />
              <span>Click pull cord to plunge back into darkness</span>
            </div>
          </div>
        </div>
      </div>

      {/* OTP Verification V3 Modal for Registration */}
      {showOtpModal && (
        <OTPVerificationV3
          email={email}
          fullName={fullName || username}
          phone={phone.replace(/\D/g, '')}
          password={password}
          initialOtpCode={generatedOtp}
          onSuccess={handleOtpSuccess}
          onCancel={() => setShowOtpModal(false)}
        />
      )}
    </div>
  );
}
