import React, { useState, useEffect } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import Auth from './components/Auth';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import Scanner from './components/Scanner';
import Analytics from './components/Analytics';
import Profile from './components/Profile';
import History from './components/History';
import Notifications from './components/Notifications';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';

type Screen = 'onboarding' | 'dashboard' | 'scanner' | 'analytics' | 'profile' | 'history' | 'notifications';

function AppContent() {
  const { user, isOnboarded, loading, isSupabaseConfigured } = useAppContext();
  const [currentScreen, setCurrentScreen] = useState<Screen>('onboarding');

  useEffect(() => {
    if (isOnboarded && currentScreen === 'onboarding') {
      setCurrentScreen('dashboard');
    }
  }, [isOnboarded, currentScreen]);

  const handleNavigate = (screen: string) => {
    setCurrentScreen(screen as Screen);
  };

  if (loading) {
    return (
      <div className="bg-[#0a0a0a] min-h-[100dvh] flex items-center justify-center text-slate-100 font-display">
        <div className="w-16 h-16 rounded-2xl glass-bright flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)] animate-pulse">
          <span className="material-symbols-outlined text-primary text-4xl">bolt</span>
        </div>
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="bg-[#0a0a0a] min-h-[100dvh] flex items-center justify-center text-slate-100 font-display p-6">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/20 flex items-center justify-center mx-auto mb-6 border border-amber-500/30">
            <span className="material-symbols-outlined text-amber-500 text-5xl">warning</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Configuration Required</h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            To use Cal.ai, you need to set up your Supabase environment variables in the AI Studio settings.
          </p>
          <div className="bg-slate-900/50 rounded-2xl p-6 text-left space-y-4 border border-white/5">
            <p className="text-sm font-medium text-slate-300 uppercase tracking-wider">Required Secrets:</p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <code className="bg-black/40 px-2 py-1 rounded text-primary">VITE_SUPABASE_URL</code>
              </li>
              <li className="flex items-center gap-3 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <code className="bg-black/40 px-2 py-1 rounded text-primary">VITE_SUPABASE_ANON_KEY</code>
              </li>
              <li className="flex items-center gap-3 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <code className="bg-black/40 px-2 py-1 rounded text-primary">GEMINI_API_KEY</code>
              </li>
            </ul>
          </div>
          <p className="text-slate-500 text-sm italic">
            Once set, refresh the page to start your journey.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-[#0a0a0a] min-h-[100dvh] text-slate-100 font-display">
        <Auth />
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] min-h-[100dvh] text-slate-100 font-display">
      {currentScreen === 'onboarding' && <Onboarding onComplete={() => handleNavigate('dashboard')} />}
      {currentScreen === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
      {currentScreen === 'scanner' && <Scanner onNavigate={handleNavigate} />}
      {currentScreen === 'analytics' && <Analytics onNavigate={handleNavigate} />}
      {currentScreen === 'profile' && <Profile onNavigate={handleNavigate} />}
      {currentScreen === 'history' && <History onNavigate={handleNavigate} />}
      {currentScreen === 'notifications' && <Notifications onNavigate={handleNavigate} />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
      <VercelAnalytics />
    </AppProvider>
  );
}
