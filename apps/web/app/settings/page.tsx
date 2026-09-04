'use client';

import React from 'react';
import { useRequireAuth } from '../../lib/auth';
import { Settings, Shield, Sliders, Server, User } from 'lucide-react';

export default function SettingsPage() {
  const { user, loading } = useRequireAuth('/login');

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="text-slate-400 text-sm font-medium">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between border-b border-dark-border pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <Settings className="h-6 w-6 text-brand-400" />
            <span>Platform Settings</span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Configure measurement engine preferences, server node selection, and security settings.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Account Profile Card */}
        <div className="glass-card rounded-2xl p-6 space-y-4 border border-dark-border">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <User className="h-4 w-4 text-brand-400" />
            <span>Account Profile</span>
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-3 rounded-xl bg-dark-bg border border-dark-border">
              <span className="text-slate-400 font-medium">Authenticated Email:</span>
              <span className="font-bold text-white">{user?.email}</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-dark-bg border border-dark-border">
              <span className="text-slate-400 font-medium">Authentication Provider:</span>
              <span className="font-bold text-emerald-400">Supabase Auth (JWT)</span>
            </div>
          </div>
        </div>

        {/* Engine Settings Card */}
        <div className="glass-card rounded-2xl p-6 space-y-4 border border-dark-border">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="h-4 w-4 text-brand-400" />
            <span>Engine Configuration</span>
          </h3>
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-300">Default Concurrency Streams ($N$)</span>
              <select defaultValue="4" className="w-full rounded-xl bg-dark-bg border border-dark-border px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500/50">
                <option value="1">1 Stream (Single Connection)</option>
                <option value="2">2 Streams (Light Parallel)</option>
                <option value="4">4 Streams (Default Parallel)</option>
                <option value="8">8 Streams (Stress Test)</option>
              </select>
            </label>
          </div>
        </div>

        {/* Edge Server Settings */}
        <div className="glass-card rounded-2xl p-6 space-y-4 border border-dark-border">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Server className="h-4 w-4 text-brand-400" />
            <span>Edge Node Directory</span>
          </h3>
          <div className="p-3 rounded-xl bg-dark-bg border border-dark-border flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-white block">IPMCAS Local Edge Server</span>
              <span className="text-[11px] text-slate-400 block">http://localhost:8000/api/v1/measurements</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">ACTIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
