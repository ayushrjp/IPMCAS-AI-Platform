import React from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { clsx } from 'clsx';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  iconColor?: string;
  subtitle?: string;
  trendText?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
}

export default function MetricCard({
  title,
  value,
  unit,
  icon: Icon,
  iconColor = 'text-brand-400',
  subtitle,
  trendText,
  trendDirection = 'neutral'
}: MetricCardProps) {
  return (
    <div className="glass-card glass-card-hover rounded-2xl p-5 border border-dark-border hover:border-brand-500/30 space-y-3 relative overflow-hidden group">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span>{title}</span>
        </span>

        {trendText && (
          <span
            className={clsx(
              'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-tight',
              trendDirection === 'up' && 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
              trendDirection === 'down' && 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
              trendDirection === 'neutral' && 'bg-slate-800 text-slate-400 border border-slate-700'
            )}
          >
            {trendDirection === 'up' && <ArrowUpRight className="h-3 w-3" />}
            {trendDirection === 'down' && <ArrowDownRight className="h-3 w-3" />}
            {trendDirection === 'neutral' && <Minus className="h-3 w-3" />}
            <span>{trendText}</span>
          </span>
        )}
      </div>

      <div>
        <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight leading-none group-hover:text-brand-400 transition-colors">
          {value}
          {unit && <span className="text-xs font-semibold text-slate-400 ml-1.5 font-sans">{unit}</span>}
        </div>
        {subtitle && <span className="text-[11px] text-slate-400 mt-1.5 block font-medium">{subtitle}</span>}
      </div>
    </div>
  );
}
