import React from 'react';
import { useAppContext } from '../context/AppContext';

interface AnalyticsProps {
  onNavigate: (screen: string) => void;
}

export default function Analytics({ onNavigate }: AnalyticsProps) {
  const { profile, entries, targets, weightHistory } = useAppContext();

  // Calculate today's totals
  const today = new Date().toISOString().split('T')[0];
  const todaysEntries = entries.filter(e => e.timestamp.startsWith(today));
  
  const consumedProtein = todaysEntries.reduce((sum, e) => sum + (e.protein || 0), 0);
  const consumedCarbs = todaysEntries.reduce((sum, e) => sum + (e.carbs || 0), 0);
  const consumedFats = todaysEntries.reduce((sum, e) => sum + (e.fats || 0), 0);
  const burnedCalories = todaysEntries.filter(e => e.type === 'activity').reduce((sum, e) => sum + Math.abs(e.calories), 0);

  const proteinPercent = Math.min(100, Math.round((consumedProtein / targets.protein) * 100)) || 0;
  const carbsPercent = Math.min(100, Math.round((consumedCarbs / targets.carbs) * 100)) || 0;
  const fatsPercent = Math.min(100, Math.round((consumedFats / targets.fats) * 100)) || 0;

  const currentWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : profile?.weight || 0;

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col bg-background-dark overflow-x-hidden pb-24 max-w-md mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-8 pb-4 sticky top-0 z-50 bg-background-dark/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl glass-bright flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-2xl">analytics</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-primary">Cal.ai</h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Performance Hub</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-xl">share</span>
          </button>
          <button onClick={() => onNavigate('profile')} className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-xl">settings</span>
          </button>
        </div>
      </header>
      
      <main className="px-6 space-y-6">
        {/* Efficiency Score - Hero Glass Card */}
        <section className="glass-bright p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all"></div>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-slate-400 text-sm font-medium mb-1">Efficiency Score</h2>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-primary tracking-tighter">94</span>
                <span className="text-slate-500 font-medium">/100</span>
              </div>
            </div>
            <div className="px-3 py-1 rounded-full glass bg-white/5 border-white/10 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary glow-dot"></span>
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Optimal</span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Metabolism</p>
              <p className="text-sm font-semibold text-slate-200">+4.2%</p>
            </div>
            <div className="space-y-1 border-x border-white/5 px-4">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Recovery</p>
              <p className="text-sm font-semibold text-slate-200">92%</p>
            </div>
            <div className="space-y-1 pl-2 text-right">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Burn</p>
              <p className="text-sm font-semibold text-slate-200">{(burnedCalories || 2400).toLocaleString()}</p>
            </div>
          </div>
        </section>
        
        {/* Weight Trend Chart Container */}
        <section className="glass p-6 rounded-2xl">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h3 className="text-slate-400 text-sm font-medium">Weight Trend</h3>
              <p className="text-2xl font-bold text-primary">{currentWeight} <span className="text-sm font-normal text-slate-500">kg</span></p>
            </div>
            <div className="flex gap-1 items-center text-primary/60 text-xs font-medium bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
              <span className="material-symbols-outlined text-sm">trending_down</span>
              2.5% this month
            </div>
          </div>
          
          <div className="relative h-48 w-full mt-4">
            {/* Simple SVG Chart Representation */}
            <svg className="w-full h-full drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" viewBox="0 0 400 150" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.15)"></stop>
                  <stop offset="100%" stopColor="rgba(255,255,255,0)"></stop>
                </linearGradient>
              </defs>
              <path d="M0,120 C40,115 60,130 100,100 C140,70 160,85 200,60 C240,35 260,50 300,30 C340,10 360,25 400,15 L400,150 L0,150 Z" fill="url(#chartGradient)"></path>
              <path d="M0,120 C40,115 60,130 100,100 C140,70 160,85 200,60 C240,35 260,50 300,30 C340,10 360,25 400,15" fill="none" stroke="white" strokeLinecap="round" strokeWidth="2.5"></path>
              <circle className="glow-dot" cx="400" cy="15" fill="white" r="4"></circle>
            </svg>
            <div className="flex justify-between mt-6 px-1">
              <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Mon</span>
              <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Wed</span>
              <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Fri</span>
              <span className="text-[10px] text-primary font-bold uppercase tracking-widest underline underline-offset-4 decoration-primary/30">Sun</span>
            </div>
          </div>
        </section>
        
        {/* Macro Progress Grid */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 ml-1">Daily Macros</h3>
          <div className="grid grid-cols-1 gap-4">
            {/* Protein */}
            <div className="glass p-5 rounded-2xl flex items-center justify-between gap-6 group">
              <div className="flex-1">
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-sm font-semibold text-slate-200">Protein</span>
                  <span className="text-xs font-bold text-primary">{consumedProtein}g <span className="text-slate-500">/ {targets.protein}g</span></span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary/90 rounded-full group-hover:bg-primary transition-all duration-700" style={{ width: `${proteinPercent}%` }}></div>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl glass-bright flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-xl">egg</span>
              </div>
            </div>
            
            {/* Carbs */}
            <div className="glass p-5 rounded-2xl flex items-center justify-between gap-6 group">
              <div className="flex-1">
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-sm font-semibold text-slate-200">Carbohydrates</span>
                  <span className="text-xs font-bold text-primary">{consumedCarbs}g <span className="text-slate-500">/ {targets.carbs}g</span></span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary/40 rounded-full group-hover:bg-primary/60 transition-all duration-700" style={{ width: `${carbsPercent}%` }}></div>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl glass-bright flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary/60 text-xl">bakery_dining</span>
              </div>
            </div>
            
            {/* Fats */}
            <div className="glass p-5 rounded-2xl flex items-center justify-between gap-6 group">
              <div className="flex-1">
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-sm font-semibold text-slate-200">Fats</span>
                  <span className="text-xs font-bold text-primary">{consumedFats}g <span className="text-slate-500">/ {targets.fats}g</span></span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary/20 rounded-full group-hover:bg-primary/40 transition-all duration-700" style={{ width: `${fatsPercent}%` }}></div>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl glass-bright flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary/40 text-xl">water_drop</span>
              </div>
            </div>
          </div>
        </section>
        
        {/* Activity Density */}
        <section className="glass p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-semibold text-slate-200">Weekly Activity</h3>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Last 7 Days</span>
          </div>
          <div className="flex items-end justify-between h-24 gap-2">
            <div className="flex-1 bg-white/5 rounded-lg h-[40%] hover:bg-white/20 transition-all"></div>
            <div className="flex-1 bg-white/10 rounded-lg h-[70%] hover:bg-white/20 transition-all"></div>
            <div className="flex-1 bg-white/5 rounded-lg h-[30%] hover:bg-white/20 transition-all"></div>
            <div className="flex-1 bg-white/20 rounded-lg h-[90%] hover:bg-white/30 transition-all"></div>
            <div className="flex-1 bg-primary/80 rounded-lg h-full relative group">
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 glass px-1.5 py-0.5 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">Max</div>
            </div>
            <div className="flex-1 bg-white/15 rounded-lg h-[60%] hover:bg-white/20 transition-all"></div>
            <div className="flex-1 bg-white/5 rounded-lg h-[45%] hover:bg-white/20 transition-all"></div>
          </div>
        </section>
      </main>
      
      {/* Fixed Bottom Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[calc(100%-3rem)] md:max-w-sm z-50">
        <div className="glass-heavy rounded-full p-2 flex items-center justify-around border border-primary/20 shadow-2xl">
          <button onClick={() => onNavigate('dashboard')} className="flex flex-col items-center justify-center size-12 rounded-full text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors">
            <span className="material-symbols-outlined text-[24px]">home</span>
          </button>
          <button className="flex flex-col items-center justify-center size-12 rounded-full bg-primary text-background-dark">
            <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
          </button>
          <div className="relative -top-1">
            <button onClick={() => onNavigate('scanner')} className="size-14 rounded-full bg-primary text-background-dark flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.4)]">
              <span className="material-symbols-outlined text-[32px]">add</span>
            </button>
          </div>
          <button onClick={() => onNavigate('history')} className="flex flex-col items-center justify-center size-12 rounded-full text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors">
            <span className="material-symbols-outlined text-[24px]">history</span>
          </button>
          <button onClick={() => onNavigate('profile')} className="flex flex-col items-center justify-center size-12 rounded-full text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors">
            <span className="material-symbols-outlined text-[24px]">account_circle</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
