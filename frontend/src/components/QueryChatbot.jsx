import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, MessageSquare, Send, X, Bot, User, Trash2, ChevronDown, Zap, Globe } from 'lucide-react';
import api from '../api';

export default function QueryChatbot({ schemas = [], activeSchema }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState('all'); // 'all' = Universal Multi-Domain
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I'm your **Argus AI Assistant**. I have real-time access to all records in your system.\n\nYou can ask me questions anytime directly from this window!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const quickPrompts = selectedDomain === 'all' ? [
    'Summarize critical alerts across all domains',
    'Compare incident reports with inventory status',
    'Executive multi-domain risk & status breakdown',
  ] : [
    `Summarize critical ${schemas.find((s) => s.entity_name === selectedDomain)?.display_name || 'records'}`,
    `Breakdown current status`,
    `Identify top priority action items`,
  ];

  const handleSend = async (queryText = inputQuery) => {
    const textToSend = queryText.trim();
    if (!textToSend || loading) return;

    const userMessage = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setLoading(true);

    try {
      // Build conversation history format for backend
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.post('/api/ai/query', {
        entity_name: selectedDomain, // 'all' queries all domains at once
        query: textToSend,
        records_context: null, // Let backend fetch all live records from database
        conversation_history: history,
      });

      const aiReply = {
        role: 'assistant',
        content: res.data.reply || 'No response generated.',
        recordsAnalyzed: res.data.records_analyzed,
        telegramConfirmed: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiReply]);
    } catch (err) {
      const errorMessage = {
        role: 'assistant',
        content: `⚠️ Failed to query AI: ${err.response?.data?.detail || err.message}. Make sure backend is running.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chatbot-wrapper">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="chatbot-fab"
          title="Open AI Knowledge Assistant"
        >
          <div className="fab-pulse"></div>
          <Sparkles className="fab-sparkle" size={18} />
          <span className="fab-label">AI Assistant</span>
          <span className="fab-badge">System Data</span>
        </button>
      )}

      {/* Chatbot Window */}
      {isOpen && (
        <div className="chatbot-window">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <div className="bot-avatar">
                <Bot size={18} />
              </div>
              <div>
                <div className="bot-title-row" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span className="bot-name">Argus Intelligence</span>
                  <span className="bot-model-tag">Groq 120B</span>
                  <span
                    className="bot-model-tag"
                    style={{
                      background: 'rgba(14, 165, 233, 0.15)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '0.1rem 0.45rem',
                      fontSize: '0.68rem',
                    }}
                    title="Queries mark confirmation to Telegram Bot"
                  >
                    <Send size={9} />
                    TG Sync
                  </span>
                </div>
                {/* Domain Selector Dropdown (Defaults to All Domains) */}
                <div className="bot-context" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                  <Globe size={12} className="zap-icon" />
                  <span>Scope:</span>
                  <select
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(e.target.value)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#67e8f9',
                      fontWeight: 600,
                      fontSize: '0.74rem',
                      borderRadius: '5px',
                      padding: '0.12rem 0.35rem',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="all" style={{ background: '#0f172a', color: '#fff' }}>
                      🌐 All Records
                    </option>
                    {(schemas || []).map((s) => (
                      <option key={s.entity_name} value={s.entity_name} style={{ background: '#0f172a', color: '#fff' }}>
                        {s.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="chatbot-header-actions">
              <button
                onClick={() => setMessages([])}
                className="btn-icon"
                title="Clear Chat History"
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="btn-icon"
                title="Close Assistant"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </div>

          {/* Quick Suggestions */}
          <div className="quick-prompts-bar">
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                disabled={loading}
                className="quick-prompt-btn"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages Body */}
          <div className="chatbot-messages">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`chat-bubble-row ${m.role === 'user' ? 'user-row' : 'bot-row'}`}
              >
                {m.role === 'assistant' && (
                  <div className="message-avatar bot">
                    <Bot size={14} />
                  </div>
                )}
                <div className={`chat-bubble ${m.role === 'user' ? 'user' : 'bot'}`}>
                  <div
                    className="bubble-content"
                    dangerouslySetInnerHTML={{
                      __html: m.content
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/\n/g, '<br/>'),
                    }}
                  />
                  <div className="bubble-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="bubble-time">{m.timestamp}</span>
                      {m.recordsAnalyzed !== undefined && (
                        <span className="bubble-analyzed">
                          Analyzed {m.recordsAnalyzed} records
                        </span>
                      )}
                    </div>
                    {m.telegramConfirmed && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          color: '#38bdf8',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          background: 'rgba(56, 189, 248, 0.1)',
                          padding: '0.05rem 0.35rem',
                          borderRadius: '4px',
                        }}
                        title="Confirmation recorded in Telegram"
                      >
                        <Send size={9} />
                        TG Notified
                      </span>
                    )}
                  </div>
                </div>
                {m.role === 'user' && (
                  <div className="message-avatar user">
                    <User size={14} />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="chat-bubble-row bot-row">
                <div className="message-avatar bot">
                  <Bot size={14} />
                </div>
                <div className="chat-bubble bot loading-bubble">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span className="loading-text">
                    Groq analyzing {selectedDomain === 'all' ? 'all system domains' : selectedDomain}...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="chatbot-input-bar">
            <textarea
              rows={1}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedDomain === 'all'
                  ? 'Ask anything across all 3 domains... (Press Enter)'
                  : `Ask about ${schemas.find((s) => s.entity_name === selectedDomain)?.display_name || 'domain'}... (Press Enter)`
              }
              disabled={loading}
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputQuery.trim() || loading}
              className="btn btn-send-chat"
              title="Send Query"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
