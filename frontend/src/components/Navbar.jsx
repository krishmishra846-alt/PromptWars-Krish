import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Eye, Plus, Lock, User, LogOut, LogIn, Sparkles } from 'lucide-react';

export default function Navbar({
  onOpenCreate,
  onOpenAdmin,
  onOpenLogin,
  onRunDemo
}) {
  const { user, role, logout } = useAuth();

  return (
    <nav className="navbar" aria-label="Main Navigation">
      <div className="nav-container">
        {/* Brand */}
        <div className="brand-group">
          <div className="brand-logo" aria-hidden="true">
            <Eye className="brand-icon" size={24} />
          </div>
          <div>
            <div className="brand-title">
              CHITRAGUPTA<span className="brand-highlight">.AI</span>
            </div>
            <div className="brand-subtitle">See what your reasoning missed.</div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="nav-actions">
          {user && (
            <>
              <button
                type="button"
                onClick={onRunDemo}
                className="btn btn-secondary"
                aria-label="Run demo scenario"
                title="Run demo scenario: 6-Month Internship"
              >
                <Sparkles size={15} className="text-amber" />
                <span>Demo Scenario</span>
              </button>

              <button
                type="button"
                onClick={onOpenCreate}
                className="btn btn-primary"
                aria-label="Analyze new decision"
              >
                <Plus size={16} aria-hidden="true" />
                <span>+ Analyze Decision</span>
              </button>
            </>
          )}

          {/* Admin Control */}
          {role === 'admin' && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="btn btn-admin"
              aria-label="Open Admin Console"
            >
              <Lock size={16} aria-hidden="true" />
              <span>Admin Console</span>
            </button>
          )}

          {/* User profile & Login/Logout */}
          <div className="user-profile-zone">
            {user ? (
              <div className="user-badge" role="region" aria-label="User Account Information">
                <div className="user-avatar" aria-hidden="true">
                  <User size={16} />
                </div>
                <div className="user-info">
                  <div className="user-name">{user.full_name || user.email}</div>
                  <span className={`role-pill ${role === 'admin' ? 'admin' : 'user'}`}>
                    {role.toUpperCase()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="btn-icon"
                  aria-label="Sign out of system"
                  title="Logout"
                >
                  <LogOut size={16} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="btn btn-login"
                aria-label="Open Login and Registration Dialog"
              >
                <LogIn size={16} aria-hidden="true" />
                <span>Login / Register</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
