import React from 'react';
import { Bot, Send, ShieldAlert } from 'lucide-react';

export default function AssistantPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-dark-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="h-6 w-6 text-brand-500" />
            <span>AI Network Intelligence Assistant</span>
          </h1>
          <p className="text-slate-400 text-sm">Ask questions about network degradation, latency spikes, or Wi-Fi stability.</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 min-h-[400px] flex flex-col justify-between space-y-4">
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-brand-500/10 border border-brand-500/20 rounded-xl p-4">
            <Bot className="h-5 w-5 text-brand-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-xs font-semibold text-brand-300 block">IPMCAS Intelligence Agent</span>
              <p className="text-sm text-slate-200 leading-relaxed">
                Hello! I am your AI Network Intelligence Assistant. I am connected to your database measurements. Ask me any question such as:
              </p>
              <ul className="text-xs text-slate-400 space-y-1 pt-2 list-disc list-inside">
                <li>"Why was my download speed lower today?"</li>
                <li>"How does my Wi-Fi compare to my 5G performance?"</li>
                <li>"Is my connection stability improving over time?"</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Ask your network assistant..."
            disabled
            className="w-full rounded-xl bg-dark-bg border border-dark-border px-4 py-3 text-sm text-slate-300 placeholder:text-slate-500 focus:outline-none cursor-not-allowed"
          />
          <button
            disabled
            className="absolute right-2 top-2 p-1.5 rounded-lg bg-brand-600/50 text-slate-400 cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
