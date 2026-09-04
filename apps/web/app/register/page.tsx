'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        throw error;
      }

      setSuccessMsg('Account created successfully! Please check your email or log in.');
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
          <UserPlus className="h-6 w-6 text-brand-500" />
          <span>Create IPMCAS Account</span>
        </h1>
        <p className="text-sm text-slate-400">Join to persist network measurements and generate comparison analytics.</p>
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

      <form onSubmit={handleRegister} className="glass-card rounded-2xl p-6 space-y-4 border border-dark-border">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              className="w-full rounded-lg bg-dark-bg border border-dark-border px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>
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
              minLength={6}
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
          {loading ? 'Registering Account...' : 'Register Account'}
        </button>

        <p className="text-xs text-center text-slate-400 pt-2">
          Already registered?{' '}
          <Link href="/login" className="text-brand-400 hover:underline">
            Sign In
          </Link>
        </p>
      </form>
    </div>
  );
}
