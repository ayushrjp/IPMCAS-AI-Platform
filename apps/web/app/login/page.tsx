'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      setSuccessMsg('Authentication successful! Redirecting to dashboard...');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
          <LogIn className="h-6 w-6 text-brand-500" />
          <span>Sign In to IPMCAS</span>
        </h1>
        <p className="text-sm text-slate-400">Access your historical network measurements and AI assistant.</p>
      </div>

      {errorMsg && (
        <div className="glass-card rounded-xl p-4 border border-red-500/30 bg-red-500/10 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <span className="text-xs text-red-300">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="glass-card rounded-xl p-4 border border-emerald-500/30 bg-emerald-500/10 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <span className="text-xs text-emerald-300">{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="glass-card rounded-2xl p-6 space-y-4 border border-dark-border">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@domain.com"
              className="w-full rounded-lg bg-dark-bg border border-dark-border px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg bg-dark-bg border border-dark-border px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-all disabled:opacity-50"
        >
          {loading ? 'Authenticating...' : 'Sign In'}
        </button>

        <p className="text-xs text-center text-slate-400 pt-2">
          Don't have an account?{' '}
          <Link href="/register" className="text-brand-400 hover:underline">
            Register here
          </Link>
        </p>
      </form>
    </div>
  );
}
