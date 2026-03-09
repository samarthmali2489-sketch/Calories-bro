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
  const { user, isOnboarded, loading } = useAppContext();
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
