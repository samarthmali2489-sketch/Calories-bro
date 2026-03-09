import React from 'react';
import { useAppContext } from '../context/AppContext';

interface HistoryProps {
  onNavigate: (screen: string) => void;
}

export default function History({ onNavigate }: HistoryProps) {
  const { entries, notifications } = useAppContext();
  const unreadCount = notifications.filter(n => !n.read).length;

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Group entries by date
  const groupedEntries = entries.reduce((acc, entry) => {
    const date = entry.timestamp.split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, typeof entries>);

  const sortedDates = Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a));

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col bg-background-dark overflow-x-hidden pb-24 max-w-md mx-auto">
      <header className="flex items-center justify-between px-6 pt-8 pb-4 sticky top-0 z-50 bg-background-dark/80 backdrop-blur-md">
        <h1 className="text-xl font-bold tracking-tight text-primary">History</h1>
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

      <main className="px-6 space-y-8 mt-4">
        {sortedDates.map(date => {
          const dayEntries = groupedEntries[date];
          const totalCalories = dayEntries.reduce((sum, e) => sum + e.calories, 0);

          return (
            <section key={date} className="space-y-4">
              <div className="flex justify-between items-end border-b border-white/10 pb-2">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">{formatDate(dayEntries[0].timestamp)}</h3>
                <span className="text-sm font-bold text-primary">{totalCalories > 0 ? '+' : ''}{totalCalories} kcal</span>
              </div>
              
              <div className="space-y-3">
                {dayEntries.map(entry => (
                  <div key={entry.id} className="glass p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="size-10 rounded-xl glass-heavy flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary/60 text-sm">
                          {entry.type === 'activity' ? 'fitness_center' : entry.category === 'Beverage' ? 'local_cafe' : 'restaurant'}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-sm">{entry.name}</p>
                        <p className="text-[10px] text-primary/40">{entry.category || 'Food'} • {formatTime(entry.timestamp)}</p>
                      </div>
                    </div>
                    <p className={`font-bold text-sm ${entry.calories < 0 ? 'text-primary' : ''}`}>
                      {entry.calories > 0 ? '+' : ''}{entry.calories}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {sortedDates.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <span className="material-symbols-outlined text-4xl mb-4 opacity-50">receipt_long</span>
            <p>No history found.</p>
          </div>
        )}
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
          <button className="flex flex-col items-center justify-center size-12 rounded-full bg-primary text-background-dark">
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
