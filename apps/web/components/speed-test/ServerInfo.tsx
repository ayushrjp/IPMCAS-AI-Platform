import React from 'react';
import { Server, Globe, ShieldCheck } from 'lucide-react';
import { ServerNode } from '@ipmcas/measurement-engine';

interface ServerInfoProps {
  server: ServerNode | null;
}

export default function ServerInfo({ server }: ServerInfoProps) {
  return (
    <div className="p-4 rounded-xl bg-dark-bg/60 border border-dark-border flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
          <Server className="h-5 w-5" />
        </div>
        <div>
          <span className="text-xs font-semibold text-white block">
            {server ? server.name : 'Best Available Server Selected'}
          </span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Globe className="h-3 w-3 text-slate-500" />
            {server ? `${server.region} (${server.country}) — ${server.baseUrl}` : 'Auto Benchmarking Edge Nodes...'}
          </span>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
        <ShieldCheck className="h-3 w-3" />
        <span>Verified Node</span>
      </div>
    </div>
  );
}
