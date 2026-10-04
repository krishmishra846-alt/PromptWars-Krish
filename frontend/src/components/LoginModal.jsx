import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  X, Lock, Mail, User, ShieldCheck, Eye, EyeOff,
  KeyRound, CheckCircle2, AlertTriangle, ShieldAlert, Loader2, ArrowRight
} from 'lucide-react';

export default function LoginModal({ isOpen, onClose }) {
  const { login, register, loginWithGoogle, loginAdminFixed } = useAuth();

  // Mode: 'admin' | 'user'
  const [authMode, setAuthMode] = useState('user'); // 'admin' | 'user'
  // User sub-tab: 'login' | 'register'
  const [userTab, setUserTab] = useState('login');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Admin Specific Fixed Credentials
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Status & Feedback
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Runaway Button Position & Dodge State
  const [buttonOffset, setButtonOffset] = useState({ x: 0, y: 0 });
  const arenaRef = useRef(null);

  // Reset fields when opening modal or changing mode
  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccess('');
      setButtonOffset({ x: 0, y: 0 });
    }
  }, [isOpen, authMode, userTab]);

  if (!isOpen) return null;

  // Calculate field completion stages
  const isField1Filled = authMode === 'admin'
    ? adminId.trim().length > 0
    : (userTab === 'register' ? (fullName.trim().length > 0 && email.trim().length > 0) : email.trim().length > 0);

  const isField2Filled = authMode === 'admin'
    ? adminPassword.trim().length > 0
    : password.trim().length > 0;

  // Stages: 0 = None, 1 = One filled, 2 = Both filled (Locked in)
  const filledStage = (isField1Filled ? 1 : 0) + (isField2Filled ? 1 : 0);

  // Evasion Handler: runs on mouseEnter/hover
  const handleButtonDodge = (e) => {
    if (filledStage >= 2 || loading) {
      setButtonOffset({ x: 0, y: 0 });
      return;
    }

    // Determine evasion intensity based on stage
    if (filledStage === 0) {
      // Stage 0: Wild & Fast Dodge (Two fields to fill before it stands still)
      const directions = [-1, 1];
      const dirX = directions[Math.floor(Math.random() * directions.length)];
      const dirY = directions[Math.floor(Math.random() * directions.length)];

      const jumpX = dirX * (75 + Math.floor(Math.random() * 65));
      const jumpY = dirY * (30 + Math.floor(Math.random() * 30));

      setButtonOffset({ x: jumpX, y: jumpY });
    } else if (filledStage === 1) {
      // Stage 1: Slowing Down (One to go • It is slowing down)
      const directions = [-1, 1];
      const dirX = directions[Math.floor(Math.random() * directions.length)];
      const dirY = directions[Math.floor(Math.random() * directions.length)];

      const jumpX = dirX * (35 + Math.floor(Math.random() * 30));
      const jumpY = dirY * (15 + Math.floor(Math.random() * 15));

      setButtonOffset({ x: jumpX, y: jumpY });
    }
  };

  // Caption text & styling based on stage
  const getCaptionInfo = () => {
    if (loading) {
      return {
        text: 'Signing you in...',
        className: 'stage-2',
      };
    }
    if (filledStage === 0) {
      return {
        text: 'Two fields to fill before it stands still',
        className: 'stage-0',
      };
    }
    if (filledStage === 1) {
      return {
        text: 'One to go • It is slowing down',
        className: 'stage-1',
      };
    }
    return {
      text: 'Locked in. Go on then',
      className: 'stage-2',
    };
  };

  const captionInfo = getCaptionInfo();

  // Submission handler
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (filledStage < 2 || loading) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (authMode === 'admin') {
        // Fixed Admin Login
        await loginAdminFixed(adminId, adminPassword);
        setSuccess('Master Administrator verified! Welcome, Chief Operations.');
      } else {
        // User Mode
        if (userTab === 'login') {
          await login(email, password);
          setSuccess('Welcome back! Successfully authenticated.');
        } else {
          await register(email, password, fullName, '');
          setSuccess('Profile created successfully! Signing you in.');
        }
      }
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth Login
  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      setSuccess('Connecting to Google Identity...');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setError(`Google Sign-In: ${err.message || 'Please enable Google Provider in Supabase or use Email login.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-pro-auth" style={{ maxWidth: '480px' }}>
        {/* Header with Security Badge */}
        <div className="auth-card-top">
          <div className="auth-brand-badge">
            {authMode === 'admin' ? (
              <ShieldAlert size={22} style={{ color: '#f59e0b' }} />
            ) : (
              <ShieldCheck size={22} className="shield-icon-pro" />
            )}
            <div>
              <div className="auth-brand-title">
                {authMode === 'admin' ? 'ADMIN SECURITY GATEWAY' : 'ARGUS IDENTITY GATEWAY'}
              </div>
              <div className="auth-brand-desc">
                {authMode === 'admin'
                  ? 'Fixed Master Administrator Access'
                  : 'Universal Role-Based Access Control'}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-close" title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Primary Role Switcher: Admin vs User */}
        <div className="auth-portal-tabs">
          <button
            type="button"
            className={`auth-portal-tab admin ${authMode === 'admin' ? 'active' : ''}`}
            onClick={() => { setAuthMode('admin'); setError(''); setSuccess(''); }}
          >
            <ShieldAlert size={16} />
            <span>Admin Portal</span>
          </button>
          <button
            type="button"
            className={`auth-portal-tab ${authMode === 'user' ? 'active' : ''}`}
            onClick={() => { setAuthMode('user'); setError(''); setSuccess(''); }}
          >
            <User size={16} />
            <span>User Portal</span>
          </button>
        </div>

        {/* ADMIN MODE: Fixed Credentials Info Banner */}
        {authMode === 'admin' && (
          <div className="admin-fixed-banner">
            <div className="admin-fixed-info">
              <span className="admin-fixed-title">Fixed Master Admin Access</span>
              <span className="admin-fixed-desc">
                Authorized Personnel Only • Enter Master ID & Password
              </span>
            </div>
          </div>
        )}

        {/* USER MODE: Google OAuth Button & Subtabs */}
        {authMode === 'user' && (
          <>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="btn-google"
            >
              <svg className="google-icon-svg" viewBox="0 0 24 24">
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
              <span>Continue with Google</span>
            </button>

            <div className="auth-divider" style={{ margin: '0.75rem 0 1rem 0' }}>
              <span>OR CONTINUE WITH EMAIL</span>
            </div>

            <div className="tab-switch-pro" style={{ marginBottom: '1.25rem' }}>
              <button
                type="button"
                className={`tab-btn-pro ${userTab === 'login' ? 'active' : ''}`}
                onClick={() => { setUserTab('login'); setError(''); setSuccess(''); }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`tab-btn-pro ${userTab === 'register' ? 'active' : ''}`}
                onClick={() => { setUserTab('register'); setError(''); setSuccess(''); }}
              >
                Create Account
              </button>
            </div>
          </>
        )}

        {/* Alerts */}
        {error && (
          <div className="error-alert" style={{ marginBottom: '1rem' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="success-alert" style={{ marginBottom: '1rem' }}>
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="auth-form-pro">
          {/* ADMIN FORM */}
          {authMode === 'admin' ? (
            <>
              <div className="input-field-group">
                <label>Admin User ID / Email</label>
                <div className="input-with-icon">
                  <ShieldAlert size={16} className="input-icon" style={{ color: '#fbbf24' }} />
                  <input
                    type="text"
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                    placeholder="admin@vibethon.ai"
                    required
                  />
                </div>
              </div>

              <div className="input-field-group">
                <label>Admin Master Password</label>
                <div className="input-with-icon">
                  <Lock size={16} className="input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter fixed admin pass (EpochZero982)"
                    required
                  />
                  <button
                    type="button"
                    className="btn-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* USER FORM */
            <>
              {userTab === 'register' && (
                <div className="input-field-group">
                  <label>Full Name</label>
                  <div className="input-with-icon">
                    <User size={16} className="input-icon" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Sarah Connor"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="input-field-group">
                <label>Email Address</label>
                <div className="input-with-icon">
                  <Mail size={16} className="input-icon" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@company.com"
                    required
                  />
                </div>
              </div>

              <div className="input-field-group">
                <label>Password</label>
                <div className="input-with-icon">
                  <KeyRound size={16} className="input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                  />
                  <button
                    type="button"
                    className="btn-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* RUNAWAY LOGIN BUTTON ARENA */}
          <div className="runaway-arena" ref={arenaRef}>
            <div
              className="runaway-btn-anchor"
              onMouseEnter={handleButtonDodge}
              onMouseMove={handleButtonDodge}
            >
              <button
                type="submit"
                disabled={filledStage < 2 || loading}
                onClick={handleSubmit}
                className={`runaway-button stage-${filledStage} ${loading ? 'stage-submitting' : ''}`}
                style={{
                  transform: filledStage === 2
                    ? 'translate(0px, 0px)'
                    : `translate(${buttonOffset.x}px, ${buttonOffset.y}px)`,
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    <span>Signing you in...</span>
                  </>
                ) : filledStage === 2 ? (
                  <>
                    <span>{authMode === 'admin' ? 'Enter Command Console' : (userTab === 'login' ? 'Log In' : 'Create Profile')}</span>
                    <ArrowRight size={17} />
                  </>
                ) : (
                  <span>Log in</span>
                )}
              </button>
            </div>

            {/* Runaway Dynamic Caption */}
            <div className={`runaway-caption ${captionInfo.className}`}>
              <span className="caption-pulse-dot" />
              <span>{captionInfo.text}</span>
            </div>
          </div>
        </form>


        <div className="auth-footer-security">
          <ShieldCheck size={14} className="security-icon-tiny" />
          <span>Secured by Supabase Identity, JWT 256-bit Encryption & Audit Logs</span>
        </div>
      </div>
    </div>
  );
}
