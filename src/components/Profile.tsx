import React from 'react';
import { useAppContext } from '../context/AppContext';

interface ProfileProps {
  onNavigate: (screen: string) => void;
}

export default function Profile({ onNavigate }: ProfileProps) {
  const { profile, logout, notifications } = useAppContext();
  const unreadCount = notifications.filter(n => !n.read).length;

  if (!profile) return null;

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col bg-background-dark overflow-x-hidden pb-24 max-w-md mx-auto">
      <header className="flex items-center justify-between px-6 pt-8 pb-4 sticky top-0 z-50 bg-background-dark/80 backdrop-blur-md">
        <h1 className="text-xl font-bold tracking-tight text-primary">Profile</h1>
        <div className="flex gap-2">
          <button onClick={() => onNavigate('notifications')} className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-colors relative">
            <span className="material-symbols-outlined text-xl">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 size-3 bg-red-500 rounded-full border-2 border-background-dark"></span>
            )}
          </button>
          <button onClick={() => onNavigate('dashboard')} className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
      </header>

      <main className="px-6 space-y-6">
        <div className="flex flex-col items-center mt-6">
          <div className="size-24 rounded-full border-2 border-primary/20 p-1 overflow-hidden mb-4">
            <img 
              alt="User Profile" 
              className="w-full h-full object-cover rounded-full" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDJImYj5jq8_EQ_cjnysvMaynI_lkpzfhDr8sYTX5vPngd-wBoNQvuPufCjmm4neXwfBSJhRjgsUSe4Tw9hBDdr5E_v1wawc2q2fmLsXQ8UMFIWtllY3sh7d2ZouHdTk17A2U2mHr3ew39RJmZuje1Rp8u2-QHAe8XVPkKwMdR2nDULCdW_mlI3JD3VgymSdXyon6opN0dFdjINI4OeGpsaWZKKAYpE6etkLPkf2JyeCWhYHEF2v9uR8yl4giUEE5JDYxD9qJgHgRY"
            />
          </div>
          <h2 className="text-2xl font-bold">{profile.name}</h2>
          <p className="text-slate-400 capitalize">{profile.goal.replace('-', ' ')} Goal</p>
        </div>

        <section className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 ml-1">Personal Details</h3>
          <div className="glass rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <span className="text-slate-300">Age</span>
              <span className="font-semibold">{profile.age}</span>
            </div>
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <span className="text-slate-300">Height</span>
              <span className="font-semibold">{profile.height} cm</span>
            </div>
            <div className="p-4 flex justify-between items-center">
              <span className="text-slate-300">Weight</span>
              <span className="font-semibold">{profile.weight} kg</span>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 ml-1">Settings</h3>
          <div className="glass rounded-2xl overflow-hidden">
            <button className="w-full p-4 border-b border-white/5 flex justify-between items-center hover:bg-white/5 transition-colors">
              <span className="text-slate-300">Notifications</span>
              <span className="material-symbols-outlined text-slate-500">chevron_right</span>
            </button>
            <button className="w-full p-4 border-b border-white/5 flex justify-between items-center hover:bg-white/5 transition-colors">
              <span className="text-slate-300">Connected Apps</span>
              <span className="material-symbols-outlined text-slate-500">chevron_right</span>
            </button>
            <button onClick={logout} className="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-colors">
              <span className="text-red-400">Sign Out</span>
            </button>
          </div>
        </section>
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[calc(100%-3rem)] md:max-w-sm z-50">
        <div className="glass-heavy rounded-full p-2 flex items-center justify-around border border-primary/20 shadow-2xl">
          <button onClick={() => onNavigate('dashboard')} className="flex flex-col items-center justify-center size-12 rounded-full text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors">
            <span className="material-symbols-outlined text-[24px]">home</span>
          </button>
          <button onClick={() => onNavigate('analytics')} className="flex flex-col items-center justify-center size-12 rounded-full text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors">
            <span className="material-symbols-outlined text-[24px]">pie_chart</span>
          </button>
          <div className="relative -top-1">
            <button onClick={() => onNavigate('scanner')} className="size-14 rounded-full bg-primary text-background-dark flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.4)]">
              <span className="material-symbols-outlined text-[32px]">add</span>
            </button>
          </div>
          <button onClick={() => onNavigate('history')} className="flex flex-col items-center justify-center size-12 rounded-full text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors">
            <span className="material-symbols-outlined text-[24px]">history</span>
          </button>
          <button className="flex flex-col items-center justify-center size-12 rounded-full bg-primary text-background-dark">
            <span className="material-symbols-outlined text-[24px]">account_circle</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
