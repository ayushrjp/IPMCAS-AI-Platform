import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AppHeader from '../components/layout/AppHeader';
import AIAssistantPanel from '../components/ai/AIAssistantPanel';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'IPMCAS — Network Intelligence & Performance Measurement Platform',
  description: 'Production-grade Internet performance measurement, network analytics, and AI diagnostic assistant platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-dark-bg text-slate-100 flex flex-col antialiased`}>
        <AppHeader />
        <div className="flex flex-1 w-full min-h-[calc(100vh-4rem)]">
          <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden">
            {children}
          </main>
          <AIAssistantPanel />
        </div>
      </body>
    </html>
  );
}
