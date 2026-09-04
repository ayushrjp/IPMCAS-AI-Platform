'use client';

import React from 'react';
import { useRequireAuth } from '../../lib/auth';
import SpeedTestCard from '../../components/speed-test/SpeedTestCard';

export default function SpeedTestPage() {
  const { user, loading } = useRequireAuth('/login');

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="text-slate-400 text-sm font-medium">Verifying authenticated session...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SpeedTestCard />
    </div>
  );
}
