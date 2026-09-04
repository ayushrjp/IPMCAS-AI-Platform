'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  ChevronRight, 
  ChevronLeft, 
  HelpCircle,
  Bot,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  Activity
} from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '../../lib/api';

interface StructuredAIResponse {
  answer?: string;
  observation: string;
  explanation: string;
  possible_cause: string;
  recommendation: string;
  evidence: string[];
  suggested_questions: string[];
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text?: string;
  structured?: StructuredAIResponse;
  timestamp: string;
}

const DEFAULT_SUGGESTIONS = [
  "Why is my download speed low?",
  "Is my latency good for gaming?",
  "Compare Wi-Fi and mobile data",
  "How can I improve my connection?"
];

export default function AIAssistantPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeMeasurementId, setActiveMeasurementId] = useState<string | null>(null);
  const [activeMeasurementContext, setActiveMeasurementContext] = useState<any>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am your AI Network Intelligence Assistant. Ask me any question about your latency, Wi-Fi stability, or speed test results.',
      timestamp: 'Just now'
    }
  ]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    const handleToggle = () => {
      setCollapsed(prev => !prev);
      setIsOpenMobile(prev => !prev);
    };

    const handleAskWithContext = (e: Event) => {
      const customEvt = e as CustomEvent;
      const { message, context, measurementId } = customEvt.detail || {};
      if (message) {
        setCollapsed(false);
        setIsOpenMobile(true);
        const targetId = measurementId || (context && (context.id || context.measurementId || context.measurement_id));
        if (targetId) {
          setActiveMeasurementId(targetId);
          if (context) setActiveMeasurementContext(context);
        }
        handleSend(message, context, targetId);
      }
    };

    const handleCurrentMeasurementUpdated = (e: Event) => {
      const customEvt = e as CustomEvent;
      const { measurementId, result } = customEvt.detail || {};
      if (measurementId) {
        setActiveMeasurementId(measurementId);
        if (result) setActiveMeasurementContext(result);
      } else {
        setActiveMeasurementId(null);
        setActiveMeasurementContext(null);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('toggle-ai-assistant', handleToggle);
      window.addEventListener('ask-ai-with-context', handleAskWithContext);
      window.addEventListener('current-measurement-updated', handleCurrentMeasurementUpdated);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('toggle-ai-assistant', handleToggle);
        window.removeEventListener('ask-ai-with-context', handleAskWithContext);
        window.removeEventListener('current-measurement-updated', handleCurrentMeasurementUpdated);
      }
    };
  }, []);

  const handleSend = async (textToSend?: string, contextOverride?: any, measurementId?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const targetId = measurementId || activeMeasurementId || (contextOverride && (contextOverride.id || contextOverride.measurementId || contextOverride.measurement_id));
    const ctx = contextOverride || activeMeasurementContext;

    if (targetId && !activeMeasurementId) {
      setActiveMeasurementId(targetId);
      if (ctx) setActiveMeasurementContext(ctx);
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await api.askAssistant(text, ctx, targetId || undefined);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        structured: res,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMsg]);
      if (res.suggested_questions && res.suggested_questions.length > 0) {
        setSuggestedQuestions(res.suggested_questions);
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: `Unable to process diagnostic query: ${err.message || 'Network error'}. Please try again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => (
    <div className="flex flex-col h-full bg-dark-card border-l border-dark-border">
      {/* Panel Header */}
      <div className="p-4 border-b border-dark-border flex items-center justify-between bg-dark-bg/60">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold">
            ✦
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-white flex items-center gap-1.5 uppercase tracking-wider">
              <span>AI NETWORK INTELLIGENCE</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </h3>
            <span className="text-[10px] text-slate-400 block font-sans">Connection Diagnostic Assistant</span>
          </div>
        </div>

        <button
          onClick={() => {
            setCollapsed(true);
            setIsOpenMobile(false);
          }}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-dark-border transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Top Insights Summary Block */}
      <div className="px-4 py-3 border-b border-dark-border bg-gradient-to-r from-dark-elevated via-dark-card to-dark-elevated">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          <span className="flex items-center gap-1 text-cyan-400">
            <Sparkles className="h-3 w-3" />
            <span>REAL-TIME NETWORK INSIGHT</span>
          </span>
          <span className="text-slate-500 font-mono">● LIVE</span>
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
          Context-aware AI analyzing multi-stream TCP throughput and RTT latency probers stored in Supabase.
        </p>
      </div>

      {/* Active Measurement Focus Banner */}
      {activeMeasurementId && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-brand-900/30 border border-brand-500/40 shadow-lg space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-extrabold text-brand-300 uppercase tracking-wider text-[10px]">
              <Sparkles className="h-3.5 w-3.5 text-brand-400 shrink-0" />
              <span>ANALYZING TEST</span>
            </div>
            <button
              onClick={() => {
                setActiveMeasurementId(null);
                setActiveMeasurementContext(null);
              }}
              className="text-[10px] font-bold text-slate-400 hover:text-white px-2 py-0.5 rounded bg-dark-bg border border-dark-border transition-colors"
            >
              Clear Focus
            </button>
          </div>
          {activeMeasurementContext ? (
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
                <span>{activeMeasurementContext.timestamp ? new Date(activeMeasurementContext.timestamp).toLocaleString() : 'Recent Test'}</span>
                <span className="px-1.5 py-0.2 rounded bg-brand-500/20 text-brand-300 font-bold">{activeMeasurementContext.status || 'COMPLETED'}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 font-mono text-[10px] text-center">
                <div className="bg-dark-bg/90 p-1.5 rounded border border-dark-border">
                  <span className="text-[8px] text-slate-400 block font-sans uppercase">Download</span>
                  <span className="font-bold text-sky-400">{activeMeasurementContext.downloadSpeedMbps ?? activeMeasurementContext.throughput_mbps ?? 0} Mbps</span>
                </div>
                <div className="bg-dark-bg/90 p-1.5 rounded border border-dark-border">
                  <span className="text-[8px] text-slate-400 block font-sans uppercase">Upload</span>
                  <span className="font-bold text-emerald-400">{activeMeasurementContext.uploadSpeedMbps ?? activeMeasurementContext.upload_speed_mbps ?? 0} Mbps</span>
                </div>
                <div className="bg-dark-bg/90 p-1.5 rounded border border-dark-border">
                  <span className="text-[8px] text-slate-400 block font-sans uppercase">Latency</span>
                  <span className="font-bold text-indigo-300">
                    {typeof activeMeasurementContext.latency === 'object' ? activeMeasurementContext.latency?.avgMs : (activeMeasurementContext.latency_avg_ms ?? 0)} ms
                  </span>
                </div>
                <div className="bg-dark-bg/90 p-1.5 rounded border border-dark-border">
                  <span className="text-[8px] text-slate-400 block font-sans uppercase">Jitter</span>
                  <span className="font-bold text-slate-300">
                    {typeof activeMeasurementContext.latency === 'object' ? activeMeasurementContext.latency?.jitterMs : (activeMeasurementContext.jitter_ms ?? 0)} ms
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[11px] font-mono text-slate-300 truncate pt-0.5">
              Target ID: {activeMeasurementId}
            </div>
          )}
        </div>
      )}

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={clsx(
              'flex flex-col gap-1 max-w-[92%]',
              msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
            )}
          >
            <div
              className={clsx(
                'p-3.5 rounded-2xl leading-relaxed',
                msg.sender === 'user'
                  ? 'bg-brand-600 text-white rounded-br-none shadow-md shadow-brand-600/10 font-medium'
                  : 'bg-dark-bg border border-dark-border text-slate-200 rounded-bl-none space-y-3'
              )}
            >
              {msg.sender === 'assistant' && (
                <div className="flex items-center gap-1.5 text-brand-400 font-bold text-[10px] uppercase tracking-wider">
                  <Bot className="h-3.5 w-3.5" />
                  <span>IPMCAS NETWORK INTELLIGENCE</span>
                </div>
              )}

              {msg.text && <p className="text-slate-300">{msg.text}</p>}

              {msg.structured && (
                <div className="space-y-3 text-xs">
                  {/* Direct Natural Answer */}
                  {(msg.structured.answer || msg.structured.observation) && (
                    <div className="p-3 rounded-xl bg-dark-card border border-dark-border space-y-2 text-slate-200 leading-relaxed font-sans">
                      <div className="whitespace-pre-wrap font-medium">
                        {(msg.structured.answer || msg.structured.observation || '').split('**').map((part: string, i: number) =>
                          i % 2 === 1 ? <strong key={i} className="text-white font-extrabold">{part}</strong> : part
                        )}
                      </div>
                    </div>
                  )}

                  {/* Evidence & Metric Chips */}
                  {msg.structured.evidence && msg.structured.evidence.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-dark-card/60 border border-dark-border space-y-1.5 font-mono text-[11px]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans block">Evidence & Database Context</span>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {msg.structured.evidence.map((ev, i) => (
                          <div key={i} className="metric-chip text-sky-300 border-sky-500/20">
                            <span>{ev}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <span className="text-[9px] text-slate-500 px-1" suppressHydrationWarning>{msg.timestamp}</span>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-dark-bg border border-dark-border text-brand-400 max-w-[70%]">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-xs font-semibold">Analyzing network history...</span>
          </div>
        )}

        {/* Suggested Queries */}
        <div className="pt-2 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <HelpCircle className="h-3 w-3 text-brand-400" />
            <span>Suggested Diagnostic Queries</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                className="text-left text-[11px] px-2.5 py-1.5 rounded-lg bg-dark-bg hover:bg-dark-border border border-dark-border text-slate-300 hover:text-white transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
        <div ref={chatEndRef} />
      </div>

      {/* Input Form Bar */}
      <div className="p-3 border-t border-dark-border bg-dark-bg/60">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your network..."
            className="flex-1 bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500/50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-40 disabled:hover:bg-brand-600 transition-all shadow-md shadow-brand-600/20"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );

  // Desktop Collapsed Bar
  if (collapsed) {
    return (
      <>
        {/* Floating Mobile/Tablet Toggle Button */}
        <button
          onClick={() => {
            setCollapsed(false);
            setIsOpenMobile(true);
          }}
          className="lg:hidden fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-2xl shadow-brand-600/50 border border-brand-400/40 hover:scale-105 transition-transform"
        >
          <Sparkles className="h-6 w-6" />
        </button>

        <div className="hidden lg:flex flex-col items-center py-4 bg-dark-card border-l border-dark-border w-12 shrink-0 transition-all">
          <button
            onClick={() => setCollapsed(false)}
            title="Expand AI Assistant"
            className="p-2 rounded-xl bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="mt-8 rotate-90 text-xs font-bold text-slate-400 tracking-widest uppercase flex items-center gap-2 whitespace-nowrap">
            <Sparkles className="h-3.5 w-3.5 text-brand-400 -rotate-90" />
            <span>AI Assistant</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop Panel View */}
      <aside className="hidden lg:flex w-80 lg:w-96 shrink-0 h-[calc(100vh-4rem)] sticky top-16 z-30">
        {renderContent()}
      </aside>

      {/* Mobile / Tablet Drawer Modal View */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="h-[85vh] w-full rounded-t-3xl overflow-hidden shadow-2xl">
            {renderContent()}
          </div>
        </div>
      )}

      {/* Floating Mobile Toggle Button */}
      {!isOpenMobile && (
        <button
          onClick={() => setIsOpenMobile(true)}
          className="lg:hidden fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-2xl shadow-brand-600/50 border border-brand-400/40 hover:scale-105 transition-transform"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}
    </>
  );
}
