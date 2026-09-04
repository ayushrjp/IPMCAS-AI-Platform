'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Zap, 
  History, 
  BarChart3, 
  Wifi, 
  GitCompare, 
  Bot, 
  Settings 
} from 'lucide-react';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Speed Test', href: '/speed-test', icon: Zap },
  { name: 'History', href: '/history', icon: History },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Networks', href: '/networks', icon: Wifi },
  { name: 'Compare', href: '/compare', icon: GitCompare },
  { name: 'AI Assistant', href: '/assistant', icon: Bot },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-dark-border bg-dark-bg/60 p-4 hidden md:block shrink-0 min-h-[calc(100vh-4rem)]">
      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-dark-hover'
              )}
            >
              <Icon className={clsx('h-4 w-4', isActive ? 'text-brand-400' : 'text-slate-500')} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
