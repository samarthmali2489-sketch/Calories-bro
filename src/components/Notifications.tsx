import React, { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

interface NotificationsProps {
  onNavigate: (screen: string) => void;
}

export default function Notifications({ onNavigate }: NotificationsProps) {
  const { notifications, markNotificationAsRead, clearAllNotifications } = useAppContext();

  // Mark all as read when opening the page
  useEffect(() => {
    notifications.forEach(n => {
      if (!n.read) {
        markNotificationAsRead(n.id);
      }
    });
  }, [notifications, markNotificationAsRead]);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMins / 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'alert': return 'warning';
      case 'success': return 'check_circle';
      case 'info':
      default: return 'info';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'alert': return 'text-red-400';
      case 'success': return 'text-emerald-400';
      case 'info':
      default: return 'text-primary';
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col bg-background-dark overflow-x-hidden pb-24 max-w-md mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-8 pb-4 sticky top-0 z-50 bg-background-dark/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('dashboard')} className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold tracking-tight text-primary">Notifications</h1>
        </div>
        {notifications.length > 0 && (
          <button onClick={clearAllNotifications} className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-white transition-colors">
            Clear All
          </button>
        )}
      </header>
      
      <main className="px-6 space-y-4 mt-4">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full glass flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-4xl text-slate-500">notifications_off</span>
            </div>
            <h2 className="text-lg font-bold text-slate-300 mb-2">All caught up!</h2>
            <p className="text-sm text-slate-500">You don't have any new notifications right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`glass p-4 rounded-2xl flex gap-4 transition-colors ${!notif.read ? 'bg-primary/5 border border-primary/20' : ''}`}
              >
                <div className={`w-10 h-10 rounded-full glass flex items-center justify-center shrink-0 ${!notif.read ? 'bg-primary/10' : ''}`}>
                  <span className={`material-symbols-outlined ${getIconColor(notif.type)}`}>
                    {getIcon(notif.type)}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`text-sm font-bold ${!notif.read ? 'text-white' : 'text-slate-300'}`}>
                      {notif.title}
                    </h3>
                    <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap ml-2">
                      {formatTime(notif.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {notif.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
