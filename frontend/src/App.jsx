import React, { useState, useEffect, lazy, Suspense } from 'react';
import Navbar from './components/Navbar';
import BlindSpotDashboard from './components/BlindSpotDashboard';
import BlindSpotAnalysisView from './components/BlindSpotAnalysisView';
import BlindSpotIntakeModal from './components/BlindSpotIntakeModal';
import { useAuth } from './context/AuthContext';
import api from './api';
import LoginPage from './components/LoginPage';
import { Loader2 } from 'lucide-react';

// Lazy-loaded components for optimal bundle efficiency
const LoginModal = lazy(() => import('./components/LoginModal'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const QueryChatbot = lazy(() => import('./components/QueryChatbot'));

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const [decisions, setDecisions] = useState([]);
  const [selectedDecision, setSelectedDecision] = useState(null);
  const [loadingDecisions, setLoadingDecisions] = useState(false);

  // Modals state
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Fetch decisions whenever authenticated
  useEffect(() => {
    if (user) {
      fetchDecisions();
    } else {
      setDecisions([]);
      setSelectedDecision(null);
    }
  }, [user?.id, user?.email]);

  const fetchDecisions = async () => {
    setLoadingDecisions(true);
    try {
      const res = await api.get('/api/decisions');
      setDecisions(res.data || []);
    } catch (e) {
      console.warn('Could not fetch decisions:', e.message);
      setDecisions([]);
    } finally {
      setLoadingDecisions(false);
    }
  };

  const handleDecisionCreated = (newDecision) => {
    setDecisions((prev) => [newDecision, ...prev]);
    setSelectedDecision(newDecision);
  };

  const handleDeleteDecision = async (decisionId) => {
    if (!window.confirm('Delete this decision and its cognitive analysis?')) return;
    try {
      await api.delete(`/api/decisions/${decisionId}`);
      setDecisions((prev) => prev.filter((d) => d.id !== decisionId));
      if (selectedDecision?.id === decisionId) {
        setSelectedDecision(null);
      }
    } catch (e) {
      alert(`Delete failed: ${e.response?.data?.detail || e.message}`);
    }
  };

  const handleUpdateDecision = (updatedDecision) => {
    setSelectedDecision(updatedDecision);
    setDecisions((prev) =>
      prev.map((d) => (d.id === updatedDecision.id ? updatedDecision : d))
    );
  };

  if (authLoading) {
    return (
      <div className="auth-splash-loading" role="status" aria-live="polite">
        <Loader2 size={36} className="spin" style={{ color: '#06b6d4' }} aria-hidden="true" />
        <p style={{ marginTop: '0.5rem', letterSpacing: '0.5px' }}>Connecting to Chitragupta.AI Engine...</p>
      </div>
    );
  }

  // Unless user has logged in, show the sleek LampLogin page
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="app-shell">
      {/* Accessibility Skip Link */}
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>

      <header role="banner">
        <Navbar
          onOpenCreate={() => setIsIntakeOpen(true)}
          onOpenAdmin={() => setIsAdminOpen(true)}
          onOpenLogin={() => setIsLoginOpen(true)}
          onRunDemo={() => setIsIntakeOpen(true)}
        />
      </header>

      <main id="main-content" className="main-content" tabIndex="-1" role="main">
        {selectedDecision ? (
          <BlindSpotAnalysisView
            decision={selectedDecision}
            onBack={() => setSelectedDecision(null)}
            onUpdateDecision={handleUpdateDecision}
          />
        ) : (
          <BlindSpotDashboard
            user={user}
            decisions={decisions}
            loading={loadingDecisions}
            onOpenCreate={() => setIsIntakeOpen(true)}
            onSelectDecision={(dec) => setSelectedDecision(dec)}
            onDeleteDecision={handleDeleteDecision}
            onRunDemo={() => setIsIntakeOpen(true)}
          />
        )}
      </main>

      {/* Decision Intake Modal */}
      <BlindSpotIntakeModal
        isOpen={isIntakeOpen}
        onClose={() => setIsIntakeOpen(false)}
        onSubmitSuccess={handleDecisionCreated}
      />

      {/* Lazy-loaded Modals */}
      <Suspense fallback={null}>
        <QueryChatbot />

        {isLoginOpen && (
          <LoginModal
            isOpen={isLoginOpen}
            onClose={() => setIsLoginOpen(false)}
          />
        )}

        {isAdminOpen && (
          <AdminPanel
            isOpen={isAdminOpen}
            onClose={() => setIsAdminOpen(false)}
          />
        )}
      </Suspense>
    </div>
  );
}
