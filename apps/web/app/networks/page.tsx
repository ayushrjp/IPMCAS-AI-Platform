'use client';

import React, { useEffect, useState } from 'react';
import { useRequireAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { Wifi, Radio, Server, CheckCircle2 } from 'lucide-react';

export default function NetworksPage() {
  const { user, loading: authLoading } = useRequireAuth('/login');
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      api.getHistory(1, 100).then((res) => setHistoryRecords(res.data || [])).catch(() => {});
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="text-slate-400 text-sm font-medium">Loading network profiles...</span>
      </div>
    );
  }

  const wifiCount = historyRecords.filter(r => (r.network?.network_type || r.networkType || 'WIFI') === 'WIFI').length;
  const ethernetCount = historyRecords.filter(r => (r.network?.network_type || r.networkType) === 'ETHERNET').length;
  const cellularCount = historyRecords.filter(r => (r.network?.network_type || r.networkType || '').includes('CELLULAR')).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-dark-border pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <Wifi className="h-6 w-6 text-brand-400" />
            <span>Saved Network Profiles</span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Detected network interfaces and environments used during measurement sessions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-6 space-y-4 border border-brand-500/20">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
              <Wifi className="h-5 w-5" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">ACTIVE</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Wi-Fi Network Profile</h3>
            <p className="text-xs text-slate-400 mt-1">Wireless LAN interface</p>
          </div>
          <div className="pt-2 border-t border-dark-border flex justify-between text-xs text-slate-300">
            <span>Recorded Sessions:</span>
            <span className="font-bold text-brand-400">{wifiCount > 0 ? wifiCount : historyRecords.length}</span>
          </div>

          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('ask-ai-with-context', {
                  detail: {
                    message: "Analyze my Wi-Fi network performance",
                    context: { networkType: "Wi-Fi", totalSessions: wifiCount || historyRecords.length }
                  }
                }));
              }
            }}
            className="w-full py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md shadow-brand-600/20 transition-all"
          >
            Ask AI About This Network
          </button>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-4 border border-dark-border opacity-70">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center">
              <Server className="h-5 w-5" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">DETECTED</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Ethernet LAN</h3>
            <p className="text-xs text-slate-400 mt-1">Direct wired connection</p>
          </div>
          <div className="pt-2 border-t border-dark-border flex justify-between text-xs text-slate-300">
            <span>Recorded Sessions:</span>
            <span className="font-bold text-slate-400">{ethernetCount}</span>
          </div>

          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('ask-ai-with-context', {
                  detail: {
                    message: "Compare Ethernet vs Wi-Fi performance",
                    context: { networkType: "Ethernet", totalSessions: ethernetCount }
                  }
                }));
              }
            }}
            className="w-full py-2 rounded-xl bg-dark-card border border-dark-border hover:bg-dark-border text-slate-300 hover:text-white font-bold text-xs transition-all"
          >
            Ask AI About Ethernet
          </button>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-4 border border-dark-border opacity-70">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center">
              <Radio className="h-5 w-5" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">DETECTED</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Cellular (4G / 5G)</h3>
            <p className="text-xs text-slate-400 mt-1">Mobile data radio</p>
          </div>
          <div className="pt-2 border-t border-dark-border flex justify-between text-xs text-slate-300">
            <span>Recorded Sessions:</span>
            <span className="font-bold text-slate-400">{cellularCount}</span>
          </div>

          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('ask-ai-with-context', {
                  detail: {
                    message: "Compare 5G/4G cellular vs Wi-Fi performance",
                    context: { networkType: "Cellular", totalSessions: cellularCount }
                  }
                }));
              }
            }}
            className="w-full py-2 rounded-xl bg-dark-card border border-dark-border hover:bg-dark-border text-slate-300 hover:text-white font-bold text-xs transition-all"
          >
            Ask AI About Cellular
          </button>
        </div>
      </div>
    </div>
  );
}
