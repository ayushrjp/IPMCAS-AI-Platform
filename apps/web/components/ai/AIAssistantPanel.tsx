'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Activity,
  History,
  MessageSquare,
  HelpCircle,
  Lightbulb,
  Trash2,
  ChevronDown
} from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '../../lib/api';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  structured?: any;
  timestamp: string;
  isError?: boolean;
}

interface InsightsData {
  summary?: string;
  throughput_status?: string;
  latency_status?: string;
  jitter_status?: string;
  overall_rating?: string;
  historical_comparison?: string;
  recommended_action?: string;
}

const CATEGORIZED_SUGGESTIONS = [
  {
    category: 'Diagnostic & Troubleshooting',
    questions: [
      'Why is my download speed low?',
      'Why is my upload speed 0 Mbps?',
      'Why is my latency so high?',
      'Why is my jitter high?',
      'Is my Wi-Fi causing this?'
    ]
  },
  {
    category: 'Use-Case Suitability',
    questions: [
      'Is my latency good for gaming?',
      'Is my connection stable?',
      'Give me a summary of my network.',
      'Explain my test results in simple terms.'
    ]
  },
  {
    category: 'Comparative & Recommendations',
    questions: [
      'Compare my current test with my previous tests.',
      'Why did my speed change?',
      'What should I check first?',
      'How can I improve my connection?'
    ]
  }
];

export default function AIAssistantPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'insights' | 'history' | 'suggestions'>('chat');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [activeMeasurementId, setActiveMeasurementId] = useState<string | null>(null);
  const [activeMeasurementContext, setActiveMeasurementContext] = useState<any>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am your IPMCAS AI Network Intelligence Assistant. I provide real-time, factually grounded network performance diagnostics. Ask me anything about your current speed test or network stability!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([
    'Why is my download speed low?',
    'Is my latency good for gaming?',
    'Is my network stable?',
    'Compare my current test with my previous tests.'
  ]);

  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, loading, activeTab]);

  // Handle global events
  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);

    const handleAskWithContext = (e: Event) => {
      const customEvt = e as CustomEvent;
      const { message, context, measurementId } = customEvt.detail || {};
      setIsOpen(true);
      setActiveTab('chat');
      const targetId = measurementId || (context && (context.id || context.measurementId || context.measurement_id));
      if (targetId) {
        setActiveMeasurementId(targetId);
        if (context) setActiveMeasurementContext(context);
      }
      if (message) {
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

  // Fetch Insights when tab selected
  useEffect(() => {
    if (activeTab === 'insights') {
      loadInsights();
    } else if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, activeMeasurementId]);

  const loadInsights = async () => {
    setInsightsLoading(true);
    try {
      const data = await api.getAIInsights(activeMeasurementId || undefined);
      setInsights(data);
    } catch (err) {
      console.warn('Failed to load AI insights:', err);
    } finally {
      setInsightsLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.getAIHistory(40);
      setHistoryList(res.conversations || []);
    } catch (err) {
      console.warn('Failed to load AI history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSend = async (textToSend?: string, contextOverride?: any, measurementId?: string) => {
    const promptText = textToSend || input;
    if (!promptText.trim() || loading) return;

    const targetId = measurementId || activeMeasurementId || (contextOverride && (contextOverride.id || contextOverride.measurementId || contextOverride.measurement_id));
    const ctx = contextOverride || activeMeasurementContext;

    if (targetId && !activeMeasurementId) {
      setActiveMeasurementId(targetId);
      if (ctx) setActiveMeasurementContext(ctx);
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: promptText,
      timestamp
    };

    // Prepare conversation history payload for multi-turn support
    const historyPayload = messages
      .filter(m => !m.isError && m.id !== 'welcome')
      .slice(-6)
      .map(m => ({ role: m.sender, content: m.text }));

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMsgPlaceholder: Message = {
      id: assistantMsgId,
      sender: 'assistant',
      text: '',
      timestamp
    };

    setMessages(prev => [...prev, assistantMsgPlaceholder]);

    try {
      let accumulatedText = '';
      let streamCompleted = false;

      try {
        const streamResult = await api.askAssistantStream(
          promptText,
          (chunk: string) => {
            accumulatedText += chunk;
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMsgId ? { ...msg, text: accumulatedText } : msg
              )
            );
          },
          historyPayload,
          ctx,
          targetId || undefined
        );
        if (streamResult?.completed) {
          streamCompleted = true;
        }
      } catch (streamErr) {
        console.warn('SSE streaming incomplete or interrupted, falling back to standard AI chat endpoint:', streamErr);
      }

      if (!streamCompleted || !accumulatedText.trim()) {
        // Fallback to non-streaming if stream produced no output, was interrupted, or failed [DONE] signal
        const res = await api.askAssistant(promptText, ctx, targetId || undefined, historyPayload);
        const finalAnswer = res.answer || res.observation || 'Analysis complete.';
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMsgId ? { ...msg, text: finalAnswer, structured: res } : msg
          )
        );
        if (res.suggested_questions?.length) {
          setSuggestedQuestions(res.suggested_questions);
        }
      }
    } catch (err: any) {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                text: "I couldn't reach the AI service right now. Your measurement data is still available.",
                isError: true
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderFormattedMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return (
          <h4 key={idx} className="font-extrabold text-white text-xs mt-2.5 mb-1 flex items-center gap-1.5 border-b border-dark-border/50 pb-1">
            <Sparkles className="h-3 w-3 text-cyan-400" />
            <span>{line.replace('### ', '')}</span>
          </h4>
        );
      }
      if (line.startsWith('- ')) {
        const itemContent = line.replace('- ', '');
        return (
          <li key={idx} className="ml-3 text-slate-300 list-disc my-0.5 leading-relaxed text-xs">
            {renderBoldText(itemContent)}
          </li>
        );
      }
      if (line.trim() === '---') {
        return <hr key={idx} className="my-2 border-dark-border/40" />;
      }
      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className="text-slate-300 leading-relaxed text-xs my-0.5">
          {renderBoldText(line)}
        </p>
      );
    });
  };

  const renderBoldText = (str: string) => {
    const parts = str.split('**');
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <strong key={i} className="text-white font-bold">
          {part}
        </strong>
      ) : (
        part
      )
    );
  };

  // FLOATING BUTTON ONLY WHEN CLOSED (Requirement 18 - NO vertical strip!)
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open IPMCAS AI Assistant"
        className="fixed bottom-6 right-6 z-50 group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-600 text-white shadow-2xl shadow-brand-600/50 border border-brand-300/30 hover:scale-105 active:scale-95 transition-all duration-200"
      >
        <div className="relative">
          <Sparkles className="h-5 w-5 text-cyan-300 animate-pulse" />
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-dark-bg" />
        </div>
        <span className="font-extrabold text-xs tracking-wider uppercase">AI Assistant</span>
      </button>
    );
  }

  // 400px FLOATING DRAWER PANEL WHEN OPEN
  return (
    <div className="fixed bottom-4 right-4 z-50 w-[94vw] sm:w-[400px] h-[600px] max-h-[88vh] rounded-3xl bg-dark-card border border-dark-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
      {/* Header */}
      <div className="p-3.5 bg-dark-bg/90 border-b border-dark-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-brand-500/20">
            ✦
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-extrabold text-white tracking-wider uppercase">
                IPMCAS AI Assistant
              </h3>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block">
              Powered by <span className="text-cyan-400 font-medium">IPMCAS AI</span>
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(false)}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-border transition-colors"
          title="Close AI Assistant"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between px-2 pt-2 bg-dark-bg/40 border-b border-dark-border text-xs">
        <button
          onClick={() => setActiveTab('chat')}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition-all text-xs',
            activeTab === 'chat'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Chat</span>
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition-all text-xs',
            activeTab === 'insights'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Insights</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition-all text-xs',
            activeTab === 'history'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <History className="h-3.5 w-3.5" />
          <span>History</span>
        </button>
        <button
          onClick={() => setActiveTab('suggestions')}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition-all text-xs',
            activeTab === 'suggestions'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <Lightbulb className="h-3.5 w-3.5" />
          <span>Suggestions</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto bg-dark-card">
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full">
            {/* Active Measurement Focus Banner */}
            {activeMeasurementContext && (
              <div className="m-3 p-2.5 rounded-2xl bg-brand-900/30 border border-brand-500/40 text-xs space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-extrabold text-brand-300 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-cyan-400" />
                    Analyzing Current Measurement
                  </span>
                  <button
                    onClick={() => {
                      setActiveMeasurementId(null);
                      setActiveMeasurementContext(null);
                    }}
                    className="text-[9px] text-slate-400 hover:text-white underline"
                  >
                    Clear Focus
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1 font-mono text-[10px] text-center pt-1">
                  <div className="bg-dark-bg/80 p-1 rounded border border-dark-border">
                    <span className="text-[8px] text-slate-400 block uppercase">DL</span>
                    <span className="font-bold text-sky-400">
                      {activeMeasurementContext.downloadSpeedMbps ?? activeMeasurementContext.throughput_mbps ?? 0} Mbps
                    </span>
                  </div>
                  <div className="bg-dark-bg/80 p-1 rounded border border-dark-border">
                    <span className="text-[8px] text-slate-400 block uppercase">UL</span>
                    <span className="font-bold text-emerald-400">
                      {activeMeasurementContext.uploadSpeedMbps ?? activeMeasurementContext.upload_speed_mbps ?? 0} Mbps
                    </span>
                  </div>
                  <div className="bg-dark-bg/80 p-1 rounded border border-dark-border">
                    <span className="text-[8px] text-slate-400 block uppercase">Ping</span>
                    <span className="font-bold text-indigo-300">
                      {typeof activeMeasurementContext.latency === 'object'
                        ? activeMeasurementContext.latency?.avgMs
                        : activeMeasurementContext.latency_avg_ms ?? 0}{' '}
                      ms
                    </span>
                  </div>
                  <div className="bg-dark-bg/80 p-1 rounded border border-dark-border">
                    <span className="text-[8px] text-slate-400 block uppercase">Jitter</span>
                    <span className="font-bold text-slate-300">
                      {typeof activeMeasurementContext.latency === 'object'
                        ? activeMeasurementContext.latency?.jitterMs
                        : activeMeasurementContext.jitter_ms ?? 0}{' '}
                      ms
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Chat Thread Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={clsx(
                    'flex flex-col max-w-[88%]',
                    msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                  )}
                >
                  <div
                    className={clsx(
                      'p-3 rounded-2xl text-xs leading-relaxed',
                      msg.sender === 'user'
                        ? 'bg-brand-600 text-white rounded-br-none shadow-md shadow-brand-600/10'
                        : msg.isError
                        ? 'bg-red-500/10 border border-red-500/30 text-red-300 rounded-bl-none'
                        : 'bg-dark-bg border border-dark-border text-slate-200 rounded-bl-none'
                    )}
                  >
                    {msg.sender === 'assistant' && !msg.isError && (
                      <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[10px] uppercase tracking-wider mb-1">
                        <Sparkles className="h-3 w-3" />
                        <span>IPMCAS AI</span>
                      </div>
                    )}

                    {msg.isError ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-red-400 font-bold">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>AI Service Unreachable</span>
                        </div>
                        <p className="text-slate-300 text-xs">{msg.text}</p>
                        <button
                          onClick={() => {
                            const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user');
                            if (lastUserMsg) handleSend(lastUserMsg.text);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold text-[11px] transition-colors"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>Retry</span>
                        </button>
                      </div>
                    ) : (
                      renderFormattedMarkdown(msg.text)
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500 px-1 pt-0.5">{msg.timestamp}</span>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-dark-bg border border-dark-border text-cyan-400 max-w-[70%] text-xs">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span className="font-semibold">Reasoning over network context...</span>
                </div>
              )}

              {/* Dynamic Suggested Questions Chips */}
              <div className="pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Suggested Questions
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(q)}
                      className="text-left text-[11px] px-2.5 py-1 rounded-xl bg-dark-bg hover:bg-dark-border border border-dark-border text-slate-300 hover:text-white transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              <div ref={chatEndRef} />
            </div>

            {/* Input Footer */}
            <div className="p-2.5 border-t border-dark-border bg-dark-bg/80">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Ask anything about your network..."
                  className="flex-1 bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500/50 resize-none max-h-24"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-40 disabled:hover:bg-brand-600 transition-all shadow-md shadow-brand-600/20 shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <div className="p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-white uppercase tracking-wider text-xs">
                Network Intelligence Insights
              </h4>
              <button
                onClick={loadInsights}
                className="p-1 text-slate-400 hover:text-white"
                title="Refresh Insights"
              >
                <RefreshCw className={clsx('h-3.5 w-3.5', insightsLoading && 'animate-spin')} />
              </button>
            </div>

            {insightsLoading ? (
              <div className="py-8 text-center text-slate-400">Loading insights...</div>
            ) : insights ? (
              <div className="space-y-2.5">
                <div className="p-3 rounded-2xl bg-dark-bg border border-dark-border">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                    Overall Network Rating
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        'px-2.5 py-0.5 rounded-full text-xs font-bold uppercase',
                        insights.overall_rating === 'Optimal'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      )}
                    >
                      {insights.overall_rating || 'Normal'}
                    </span>
                    <span className="text-slate-300 text-xs">{insights.summary}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-2xl bg-dark-bg border border-dark-border">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Throughput</span>
                    <span className="font-extrabold text-sky-400 text-xs">{insights.throughput_status}</span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-dark-bg border border-dark-border">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Latency</span>
                    <span className="font-extrabold text-indigo-300 text-xs">{insights.latency_status}</span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-dark-bg border border-dark-border">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Jitter</span>
                    <span className="font-extrabold text-slate-300 text-xs">{insights.jitter_status}</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-dark-bg border border-dark-border space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Historical Baseline Comparison
                  </span>
                  <p className="text-slate-300 leading-relaxed text-xs">{insights.historical_comparison}</p>
                </div>

                <div className="p-3 rounded-2xl bg-brand-950/40 border border-brand-500/30 space-y-1">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase block">
                    Recommended Action
                  </span>
                  <p className="text-slate-200 leading-relaxed text-xs">{insights.recommended_action}</p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400">No insight data available.</div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-white uppercase tracking-wider text-xs">
                Conversation History
              </h4>
              <button
                onClick={loadHistory}
                className="p-1 text-slate-400 hover:text-white"
                title="Refresh History"
              >
                <RefreshCw className={clsx('h-3.5 w-3.5', historyLoading && 'animate-spin')} />
              </button>
            </div>

            {historyLoading ? (
              <div className="py-8 text-center text-slate-400">Loading conversation history...</div>
            ) : historyList.length > 0 ? (
              <div className="space-y-2">
                {historyList.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-2.5 rounded-2xl bg-dark-bg border border-dark-border space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-bold uppercase text-brand-400">{item.role}</span>
                      <span>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</span>
                    </div>
                    <p className="text-slate-300 line-clamp-3 text-xs">{item.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400">
                No past conversation records found. Messages automatically sync when logged in.
              </div>
            )}
          </div>
        )}

        {/* Suggestions Tab */}
        {activeTab === 'suggestions' && (
          <div className="p-4 space-y-4 text-xs">
            <h4 className="font-extrabold text-white uppercase tracking-wider text-xs">
              Suggested Diagnostic Questions
            </h4>
            {CATEGORIZED_SUGGESTIONS.map((cat, idx) => (
              <div key={idx} className="space-y-2">
                <span className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-wider block">
                  {cat.category}
                </span>
                <div className="space-y-1.5">
                  {cat.questions.map((q, qIdx) => (
                    <button
                      key={qIdx}
                      onClick={() => {
                        setActiveTab('chat');
                        handleSend(q);
                      }}
                      className="w-full text-left p-2.5 rounded-2xl bg-dark-bg hover:bg-dark-border border border-dark-border text-slate-300 hover:text-white transition-colors flex items-center justify-between group text-xs"
                    >
                      <span>{q}</span>
                      <Sparkles className="h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
