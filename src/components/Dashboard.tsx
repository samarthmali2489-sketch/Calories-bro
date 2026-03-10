import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateAIContent } from '../lib/ai';

interface DashboardProps {
  onNavigate: (screen: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { profile, entries, targets, notifications } = useAppContext();
  const unreadCount = notifications.filter(n => !n.read).length;
  const [aiStatus, setAiStatus] = useState<string | null>(() => {
    const cached = localStorage.getItem('aiStatus');
    const cachedTime = localStorage.getItem('aiStatusTime');
    if (cached && cachedTime && (new Date().getTime() - Number(cachedTime) < 3600000)) {
      return cached;
    }
    return null;
  });

  // Calculate today's totals
  const today = new Date().toISOString().split('T')[0];
  const todaysEntries = entries.filter(e => e.timestamp.startsWith(today));
  
  const consumedCalories = todaysEntries.filter(e => e.type === 'food').reduce((sum, e) => sum + e.calories, 0);
  const burnedCalories = todaysEntries.filter(e => e.type === 'activity').reduce((sum, e) => sum + Math.abs(e.calories), 0);
  const netCalories = consumedCalories - burnedCalories;
  
  const consumedProtein = todaysEntries.reduce((sum, e) => sum + (e.protein || 0), 0);
  const consumedCarbs = todaysEntries.reduce((sum, e) => sum + (e.carbs || 0), 0);
  const consumedFats = todaysEntries.reduce((sum, e) => sum + (e.fats || 0), 0);

  const caloriesLeft = Math.max(0, targets.calories - netCalories);
  
  const proteinPercent = Math.min(100, Math.round((consumedProtein / targets.protein) * 100)) || 0;
  const carbsPercent = Math.min(100, Math.round((consumedCarbs / targets.carbs) * 100)) || 0;
  const fatsPercent = Math.min(100, Math.round((consumedFats / targets.fats) * 100)) || 0;

  useEffect(() => {
    const fetchAiStatus = async () => {
      // Don't fetch if we already have a recent status and data hasn't changed much
      const lastData = localStorage.getItem('aiStatusData');
      const currentData = JSON.stringify({ consumedCalories, consumedProtein, goal: profile?.goal });
      
      if (aiStatus && lastData === currentData) return;

      try {
        const context = `
          Goal: ${profile?.goal}
          Calories: ${consumedCalories}/${targets.calories}
          Protein: ${consumedProtein}/${targets.protein}g
          Time: ${new Date().toLocaleTimeString()}
        `;
        const response = await generateAIContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: `Context: ${context}\n\nProvide a 3-word status for the user's progress today (e.g. "On Track", "Need More Protein", "Perfect Balance").`,
        });
        if (response.text) {
          const status = response.text.replace(/[".]/g, '');
          setAiStatus(status);
          localStorage.setItem('aiStatus', status);
          localStorage.setItem('aiStatusTime', new Date().getTime().toString());
          localStorage.setItem('aiStatusData', currentData);
        }
      } catch (e) {
        setAiStatus("Tracking...");
      }
    };
    if (todaysEntries.length > 0) fetchAiStatus();
    else setAiStatus("Ready to log");
  }, [consumedCalories, consumedProtein, targets, profile?.goal, todaysEntries.length]);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col max-w-md mx-auto overflow-hidden">
      <header className="flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full border border-primary/20 p-0.5 overflow-hidden">
            <img 
              alt="User Profile" 
              className="w-full h-full object-cover rounded-full" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDJImYj5jq8_EQ_cjnysvMaynI_lkpzfhDr8sYTX5vPngd-wBoNQvuPufCjmm4neXwfBSJhRjgsUSe4Tw9hBDdr5E_v1wawc2q2fmLsXQ8UMFIWtllY3sh7d2ZouHdTk17A2U2mHr3ew39RJmZuje1Rp8u2-QHAe8XVPkKwMdR2nDULCdW_mlI3JD3VgymSdXyon6opN0dFdjINI4OeGpsaWZKKAYpE6etkLPkf2JyeCWhYHEF2v9uR8yl4giUEE5JDYxD9qJgHgRY"
            />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-primary/50 font-semibold">
              {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {profile?.name || 'Alex'}
            </p>
            <h2 className="text-xl font-bold tracking-tight">Cal.ai</h2>
          </div>
        </div>
        <button onClick={() => onNavigate('notifications')} className="size-10 glass rounded-full flex items-center justify-center relative hover:bg-white/10 transition-colors">
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 size-3 bg-red-500 rounded-full border-2 border-background-dark"></span>
          )}
        </button>
      </header>
      
      <main className="flex-1 px-6 pb-24">
        <div className="relative flex flex-col items-center justify-center py-10">
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <div className="w-64 h-64 rounded-full bg-primary blur-[80px]"></div>
          </div>
          <div className="relative size-64 glass-heavy rounded-full glow-circle flex flex-col items-center justify-center border-2 border-primary/10">
            <div className="absolute inset-4 rounded-full border border-dashed border-primary/20 animate-[spin_20s_linear_infinite]"></div>
            <span className="text-primary/60 text-sm font-medium tracking-wide uppercase">Left</span>
            <h1 className="text-6xl font-light tracking-tighter my-1">{caloriesLeft.toLocaleString()}</h1>
            <span className="text-xs text-primary/40 font-medium">of {targets.calories.toLocaleString()} kcal</span>
            <div className="mt-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{aiStatus || 'Analyzing...'}</p>
            </div>
            <div className="absolute bottom-8 flex gap-1">
              <div className="w-1 h-1 rounded-full bg-primary"></div>
              <div className="w-1 h-1 rounded-full bg-primary/30"></div>
              <div className="w-1 h-1 rounded-full bg-primary/30"></div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-3 my-8">
          <div className="glass p-4 rounded-2xl flex flex-col items-center gap-2">
            <div className="relative size-12 flex items-center justify-center">
              <svg className="absolute size-full -rotate-90" viewBox="0 0 36 36">
                <circle className="stroke-primary/10" cx="18" cy="18" fill="none" r="16" strokeWidth="2"></circle>
                <circle className="stroke-primary" cx="18" cy="18" fill="none" r="16" strokeDasharray={`${proteinPercent}, 100`} strokeLinecap="round" strokeWidth="2"></circle>
              </svg>
              <span className="text-[10px] font-bold">{proteinPercent}%</span>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-primary/50 font-bold uppercase tracking-wider">Protein</p>
              <p className="text-sm font-bold">{consumedProtein}g</p>
            </div>
          </div>
          
          <div className="glass p-4 rounded-2xl flex flex-col items-center gap-2">
            <div className="relative size-12 flex items-center justify-center">
              <svg className="absolute size-full -rotate-90" viewBox="0 0 36 36">
                <circle className="stroke-primary/10" cx="18" cy="18" fill="none" r="16" strokeWidth="2"></circle>
                <circle className="stroke-primary" cx="18" cy="18" fill="none" r="16" strokeDasharray={`${carbsPercent}, 100`} strokeLinecap="round" strokeWidth="2"></circle>
              </svg>
              <span className="text-[10px] font-bold">{carbsPercent}%</span>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-primary/50 font-bold uppercase tracking-wider">Carbs</p>
              <p className="text-sm font-bold">{consumedCarbs}g</p>
            </div>
          </div>
          
          <div className="glass p-4 rounded-2xl flex flex-col items-center gap-2">
            <div className="relative size-12 flex items-center justify-center">
              <svg className="absolute size-full -rotate-90" viewBox="0 0 36 36">
                <circle className="stroke-primary/10" cx="18" cy="18" fill="none" r="16" strokeWidth="2"></circle>
                <circle className="stroke-primary" cx="18" cy="18" fill="none" r="16" strokeDasharray={`${fatsPercent}, 100`} strokeLinecap="round" strokeWidth="2"></circle>
              </svg>
              <span className="text-[10px] font-bold">{fatsPercent}%</span>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-primary/50 font-bold uppercase tracking-wider">Fats</p>
              <p className="text-sm font-bold">{consumedFats}g</p>
            </div>
          </div>
        </div>
        
        <section className="mt-10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold tracking-tight">Recent Entries</h3>
            <button onClick={() => onNavigate('history')} className="text-xs font-bold text-primary/50 uppercase tracking-widest">View All</button>
          </div>
          <div className="space-y-[-12px]">
            {todaysEntries.slice(0, 3).map((entry, index) => (
              <div 
                key={entry.id} 
                className={`glass relative p-4 rounded-2xl flex items-center justify-between border-t border-primary/20 shadow-xl`}
                style={{ 
                  zIndex: 30 - index * 10,
                  opacity: 1 - index * 0.2,
                  transform: `scale(${1 - index * 0.02})`
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-xl glass-heavy flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary/60">
                      {entry.type === 'activity' ? 'fitness_center' : entry.category === 'Beverage' ? 'local_cafe' : 'restaurant'}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold">{entry.name}</p>
                    <p className="text-xs text-primary/40">{entry.category || 'Food'} • {formatTime(entry.timestamp)}</p>
                  </div>
                </div>
                <p className={`font-bold ${entry.calories < 0 ? 'text-primary' : ''}`}>
                  {entry.calories > 0 ? '+' : ''}{entry.calories} kcal
                </p>
              </div>
            ))}
            {todaysEntries.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">
                No entries yet today. Scan a meal to get started!
              </div>
            )}
          </div>
        </section>
      </main>
      
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[calc(100%-3rem)] md:max-w-sm z-50">
        <div className="glass-heavy rounded-full p-2 flex items-center justify-around border border-primary/20 shadow-2xl">
          <button onClick={() => onNavigate('dashboard')} className="flex flex-col items-center justify-center size-12 rounded-full bg-primary text-background-dark">
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
          <button onClick={() => onNavigate('profile')} className="flex flex-col items-center justify-center size-12 rounded-full text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors">
            <span className="material-symbols-outlined text-[24px]">account_circle</span>
          </button>
        </div>
      </nav>
      
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-[-1] overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[40%] bg-primary/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[40%] bg-primary/5 blur-[120px] rounded-full"></div>
      </div>
    </div>
  );
}
