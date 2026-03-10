import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';

interface AnalyticsProps {
  onNavigate: (screen: string) => void;
}

export default function Analytics({ onNavigate }: AnalyticsProps) {
  const { profile, entries, targets, weightHistory, notifications } = useAppContext();
  const unreadCount = notifications.filter(n => !n.read).length;
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const context = `
        User Profile: ${JSON.stringify(profile)}
        Targets: ${JSON.stringify(targets)}
        Recent Entries: ${JSON.stringify(entries.slice(0, 20))}
        Current Weight: ${currentWeight}
      `;
      
      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3.1-flash-lite-preview',
        contents: `Context: ${context}\n\nUser Question: ${userMsg}\n\nYou are Cal.ai, an intelligent nutrition assistant. Provide a helpful, concise, and encouraging response based on the user's data. Use markdown for formatting.`,
      });
      
      setChatMessages(prev => [...prev, { role: 'model', text: '' }]);
      
      for await (const chunk of responseStream) {
        setChatMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].text += chunk.text;
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const filteredEntries = useMemo(() => {
    const now = new Date();
    return entries.filter(e => {
      const entryDate = new Date(e.timestamp);
      if (timeRange === 'daily') {
        return entryDate.toDateString() === now.toDateString();
      } else if (timeRange === 'weekly') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return entryDate >= weekAgo;
      } else {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return entryDate >= monthAgo;
      }
    });
  }, [entries, timeRange]);

  const daysInRange = timeRange === 'daily' ? 1 : timeRange === 'weekly' ? 7 : 30;
  
  const consumedProtein = Math.round(filteredEntries.reduce((sum, e) => sum + (e.protein || 0), 0) / daysInRange);
  const consumedCarbs = Math.round(filteredEntries.reduce((sum, e) => sum + (e.carbs || 0), 0) / daysInRange);
  const consumedFats = Math.round(filteredEntries.reduce((sum, e) => sum + (e.fats || 0), 0) / daysInRange);
  const consumedCalories = Math.round(filteredEntries.filter(e => e.type === 'food').reduce((sum, e) => sum + (e.calories || 0), 0) / daysInRange);
  const burnedCalories = Math.round(filteredEntries.filter(e => e.type === 'activity').reduce((sum, e) => sum + Math.abs(e.calories), 0) / daysInRange);

  const proteinPercent = Math.min(100, Math.round((consumedProtein / targets.protein) * 100)) || 0;
  const carbsPercent = Math.min(100, Math.round((consumedCarbs / targets.carbs) * 100)) || 0;
  const fatsPercent = Math.min(100, Math.round((consumedFats / targets.fats) * 100)) || 0;

  // Calculate Efficiency Score (based on macro adherence and consistency)
  const efficiencyScore = useMemo(() => {
    if (targets.calories === 0) return 0;
    const pScore = Math.min(100, (consumedProtein / targets.protein) * 100);
    const cScore = Math.min(100, (consumedCarbs / targets.carbs) * 100);
    const fScore = Math.min(100, (consumedFats / targets.fats) * 100);
    const calScore = Math.min(100, (consumedCalories / targets.calories) * 100);
    
    // Consistency factor: how many days in the range have entries
    const daysWithEntries = new Set(filteredEntries.map(e => e.timestamp.split('T')[0])).size;
    const consistencyFactor = (daysWithEntries / daysInRange);
    
    // Weighted average: 70% macro/cal completion, 30% consistency
    const completionScore = (pScore + cScore + fScore + calScore) / 4;
    const score = Math.round((completionScore * 0.7) + (consistencyFactor * 100 * 0.3));
    
    return score || 0;
  }, [consumedProtein, consumedCarbs, consumedFats, consumedCalories, targets, filteredEntries, daysInRange]);

  const [aiInsight, setAiInsight] = useState<string | null>(() => {
    const cached = localStorage.getItem('aiInsight');
    const cachedTime = localStorage.getItem('aiInsightTime');
    if (cached && cachedTime && (new Date().getTime() - Number(cachedTime) < 3600000)) {
      return cached;
    }
    return null;
  });
  const [isInsightLoading, setIsInsightLoading] = useState(false);

  useEffect(() => {
    const fetchInsight = async () => {
      const currentData = JSON.stringify({ timeRange, efficiencyScore, consumedProtein, goal: profile?.goal });
      const lastData = localStorage.getItem('aiInsightData');
      
      if (aiInsight && lastData === currentData) return;

      setIsInsightLoading(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const context = `
          Time Range: ${timeRange}
          Efficiency Score: ${efficiencyScore}
          Protein: ${consumedProtein}/${targets.protein}g
          Carbs: ${consumedCarbs}/${targets.carbs}g
          Fats: ${consumedFats}/${targets.fats}g
          Calories: ${consumedCalories}/${targets.calories}kcal
          Goal: ${profile?.goal}
        `;
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: `Context: ${context}\n\nProvide a single, short, punchy sentence (max 15 words) of actionable advice or encouragement based on this nutrition data. Make it specific to their ${profile?.goal} goal.`,
        });
        if (response.text) {
          setAiInsight(response.text);
          localStorage.setItem('aiInsight', response.text);
          localStorage.setItem('aiInsightTime', new Date().getTime().toString());
          localStorage.setItem('aiInsightData', currentData);
        }
      } catch (e) {
        setAiInsight("Keep tracking your meals to get personalized insights!");
      } finally {
        setIsInsightLoading(false);
      }
    };
    
    fetchInsight();
  }, [timeRange, efficiencyScore, consumedProtein, consumedCarbs, consumedFats, consumedCalories, targets, profile?.goal]);

  const [deepAnalysis, setDeepAnalysis] = useState<string | null>(() => {
    const cached = localStorage.getItem('deepAnalysis');
    const cachedTime = localStorage.getItem('deepAnalysisTime');
    // Cache for 24 hours
    if (cached && cachedTime && (new Date().getTime() - Number(cachedTime) < 86400000)) {
      return cached;
    }
    return null;
  });
  const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);

  const fetchDeepAnalysis = async () => {
    setIsDeepAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const context = `
        User Profile: ${JSON.stringify(profile)}
        Targets: ${JSON.stringify(targets)}
        Entries (Last 30 days): ${JSON.stringify(entries.slice(0, 50))}
        Weight History: ${JSON.stringify(weightHistory)}
        Time Range: ${timeRange}
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: `Context: ${context}\n\nProvide a comprehensive "Deep Performance Analysis" for the user. 
        Include:
        1. Macro-nutrient balance analysis.
        2. Consistency score and why.
        3. Predicted weight trend for the next 2 weeks based on current habits.
        4. 3 specific, actionable adjustments to reach their goal faster.
        
        Format the response using professional markdown with clear headings and bullet points. Keep it encouraging but data-driven.`,
      });
      
      if (response.text) {
        setDeepAnalysis(response.text);
        localStorage.setItem('deepAnalysis', response.text);
        localStorage.setItem('deepAnalysisTime', new Date().getTime().toString());
      }
    } catch (error) {
      console.error('Deep analysis error:', error);
      setDeepAnalysis("I couldn't generate a deep analysis right now. Please try again later.");
    } finally {
      setIsDeepAnalyzing(false);
    }
  };

  const currentWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : profile?.weight || 0;
  
  // Calculate Weight Trend
  const weightTrend = useMemo(() => {
    if (weightHistory.length < 2) return { value: 0, isDown: true };
    const firstOfMonth = weightHistory[0].weight;
    const diff = currentWeight - firstOfMonth;
    const percent = (diff / firstOfMonth) * 100;
    return {
      value: Math.abs(percent).toFixed(1),
      isDown: percent <= 0
    };
  }, [weightHistory, currentWeight]);

  // Generate Weekly Activity Data
  const weeklyActivity = useMemo(() => {
    const days = [];
    let maxBurn = 1; // Prevent division by zero
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayEntries = entries.filter(e => e.timestamp.startsWith(dateStr) && e.type === 'activity');
      const burn = dayEntries.reduce((sum, e) => sum + Math.abs(e.calories), 0);
      
      if (burn > maxBurn) maxBurn = burn;
      days.push({ date: dateStr, burn });
    }
    
    return days.map(d => ({
      ...d,
      heightPercent: Math.max(10, (d.burn / maxBurn) * 100) // Min 10% height for visual
    }));
  }, [entries]);

  // Generate SVG Path for Weight Chart
  const chartPath = useMemo(() => {
    if (weightHistory.length < 2) {
      return "M0,120 C40,115 60,130 100,100 C140,70 160,85 200,60 C240,35 260,50 300,30 C340,10 360,25 400,15";
    }
    
    const recentWeights = weightHistory.slice(-7); // Last 7 entries
    if (recentWeights.length === 1) return "M0,75 L400,75";
    
    const maxW = Math.max(...recentWeights.map(w => w.weight));
    const minW = Math.min(...recentWeights.map(w => w.weight));
    const range = maxW - minW || 1; // Avoid div by 0
    
    const points = recentWeights.map((w, i) => {
      const x = (i / (recentWeights.length - 1)) * 400;
      // Y is inverted (0 is top, 150 is bottom), add padding
      const y = 130 - ((w.weight - minW) / range) * 110; 
      return `${x},${y}`;
    });

    // Create smooth curve
    let d = `M${points[0]}`;
    for (let i = 1; i < points.length; i++) {
      const [prevX, prevY] = points[i-1].split(',').map(Number);
      const [currX, currY] = points[i].split(',').map(Number);
      const cp1x = prevX + (currX - prevX) / 2;
      d += ` C${cp1x},${prevY} ${cp1x},${currY} ${currX},${currY}`;
    }
    return d;
  }, [weightHistory]);

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
          <button onClick={() => onNavigate('notifications')} className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-colors relative">
            <span className="material-symbols-outlined text-xl">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 size-3 bg-red-500 rounded-full border-2 border-background-dark"></span>
            )}
          </button>
          <button onClick={() => setIsChatOpen(true)} className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-colors relative">
            <span className="material-symbols-outlined text-xl text-primary">smart_toy</span>
            <span className="absolute top-0 right-0 w-3 h-3 bg-primary rounded-full border-2 border-background-dark"></span>
          </button>
        </div>
      </header>
      
      <main className="px-6 space-y-6">
        {/* Time Range Selector */}
        <div className="flex bg-white/5 p-1 rounded-xl">
          {(['daily', 'weekly', 'monthly'] as const).map((range) => (
            <button 
              key={range}
              onClick={() => setTimeRange(range)} 
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${timeRange === range ? 'bg-primary text-background-dark' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {range}
            </button>
          ))}
        </div>

        {/* AI Insight */}
        <div className="glass p-4 rounded-2xl flex items-start gap-3 border border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => setIsChatOpen(true)}>
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-primary text-sm">auto_awesome</span>
          </div>
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">AI Insight</h3>
            {isInsightLoading ? (
              <div className="flex items-center gap-1 h-5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0.4s' }}></span>
              </div>
            ) : (
              <p className="text-sm text-slate-200 leading-snug">{aiInsight}</p>
            )}
          </div>
        </div>

        {/* Efficiency Score - Hero Glass Card */}
        <section className="glass-bright p-6 rounded-2xl relative overflow-hidden group cursor-pointer hover:border-primary/30 transition-colors">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all"></div>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-slate-400 text-sm font-medium mb-1">Efficiency Score</h2>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-primary tracking-tighter">{efficiencyScore}</span>
                <span className="text-slate-500 font-medium">/100</span>
              </div>
            </div>
            <div className="px-3 py-1 rounded-full glass bg-white/5 border-white/10 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full glow-dot ${efficiencyScore >= 80 ? 'bg-primary' : efficiencyScore >= 50 ? 'bg-yellow-400' : 'bg-red-500'}`}></span>
              <span className={`text-[11px] font-bold uppercase tracking-wider ${efficiencyScore >= 80 ? 'text-primary' : efficiencyScore >= 50 ? 'text-yellow-400' : 'text-red-500'}`}>
                {efficiencyScore >= 80 ? 'Optimal' : efficiencyScore >= 50 ? 'Average' : 'Low'}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Metabolism</p>
              <p className="text-sm font-semibold text-slate-200">{profile?.goal === 'loss' ? '+4.2%' : 'Normal'}</p>
            </div>
            <div className="space-y-1 border-x border-white/5 px-4">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Recovery</p>
              <p className="text-sm font-semibold text-slate-200">{Math.min(100, efficiencyScore + 10)}%</p>
            </div>
            <div className="space-y-1 pl-2 text-right">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Burn</p>
              <p className="text-sm font-semibold text-slate-200">{burnedCalories.toLocaleString()}</p>
            </div>
          </div>
        </section>
        
        {/* Weight Trend Chart Container */}
        <section className="glass p-6 rounded-2xl cursor-pointer hover:border-primary/30 transition-colors">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h3 className="text-slate-400 text-sm font-medium">Weight Trend</h3>
              <p className="text-2xl font-bold text-primary">{currentWeight} <span className="text-sm font-normal text-slate-500">kg</span></p>
            </div>
            <div className="flex gap-1 items-center text-primary/60 text-xs font-medium bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
              <span className="material-symbols-outlined text-sm">{weightTrend.isDown ? 'trending_down' : 'trending_up'}</span>
              {weightTrend.value}% this month
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
              <path d={`${chartPath} L400,150 L0,150 Z`} fill="url(#chartGradient)"></path>
              <path d={chartPath} fill="none" stroke="white" strokeLinecap="round" strokeWidth="2.5"></path>
              <circle className="glow-dot" cx="400" cy={chartPath.split(',').pop()} fill="white" r="4"></circle>
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
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 ml-1">Average Macros ({timeRange})</h3>
          <div className="grid grid-cols-1 gap-4">
            {/* Protein */}
            <div className="glass p-5 rounded-2xl flex items-center justify-between gap-6 group cursor-pointer hover:border-primary/30 transition-colors">
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
            <div className="glass p-5 rounded-2xl flex items-center justify-between gap-6 group cursor-pointer hover:border-primary/30 transition-colors">
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
            <div className="glass p-5 rounded-2xl flex items-center justify-between gap-6 group cursor-pointer hover:border-primary/30 transition-colors">
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
        <section className="glass p-6 rounded-2xl cursor-pointer hover:border-primary/30 transition-colors">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-semibold text-slate-200">Weekly Activity</h3>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Last 7 Days</span>
          </div>
          <div className="flex items-end justify-between h-24 gap-2">
            {weeklyActivity.map((day, i) => (
              <div 
                key={i} 
                className={`flex-1 rounded-lg relative group transition-all ${i === 6 ? 'bg-primary/80' : 'bg-white/10 hover:bg-white/20'}`}
                style={{ height: `${day.heightPercent}%` }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 glass px-1.5 py-0.5 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {day.burn} kcal
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Deep AI Analysis Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 ml-1">AI Performance Report</h3>
            {!deepAnalysis && !isDeepAnalyzing && (
              <button 
                onClick={fetchDeepAnalysis}
                className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">analytics</span>
                Generate Report
              </button>
            )}
          </div>

          {isDeepAnalyzing ? (
            <div className="glass p-8 rounded-2xl flex flex-col items-center justify-center gap-4 border border-primary/20">
              <div className="relative size-12">
                <div className="absolute inset-0 border-2 border-primary/20 rounded-full"></div>
                <div className="absolute inset-0 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-sm text-primary/60 font-medium animate-pulse">AI is analyzing your habits...</p>
            </div>
          ) : deepAnalysis ? (
            <div className="glass p-6 rounded-2xl border border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">auto_awesome</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-primary">Deep Analysis</span>
                </div>
                <button onClick={fetchDeepAnalysis} className="text-[10px] text-slate-500 hover:text-primary transition-colors">Regenerate</button>
              </div>
              <div className="markdown-body prose prose-invert prose-sm max-w-none">
                <Markdown>{deepAnalysis}</Markdown>
              </div>
            </div>
          ) : (
            <div 
              onClick={fetchDeepAnalysis}
              className="glass p-8 rounded-2xl flex flex-col items-center justify-center gap-3 border border-dashed border-white/10 cursor-pointer hover:border-primary/30 transition-colors group"
            >
              <div className="size-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <span className="material-symbols-outlined text-primary/40 group-hover:text-primary transition-colors">psychology</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-300">Unlock Deep Analysis</p>
                <p className="text-xs text-slate-500">Get AI-powered insights on your consistency and predicted progress.</p>
              </div>
            </div>
          )}
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

      {/* Chatbot Modal */}
      {isChatOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background-dark/95 backdrop-blur-xl animate-in fade-in duration-200">
          <header className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full glass flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">smart_toy</span>
              </div>
              <div>
                <h2 className="text-white font-bold tracking-tight">AI Coach</h2>
                <p className="text-[10px] text-primary uppercase tracking-widest font-semibold">Online</p>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-sm">smart_toy</span>
              </div>
              <div className="bg-white/10 rounded-2xl rounded-tl-none p-4 text-sm text-white/90 leading-relaxed">
                Hi! I'm your Cal.ai coach. I've analyzed your {timeRange} performance. Your efficiency score is {efficiencyScore}/100. How can I help you improve today?
              </div>
            </div>

            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary text-background-dark' : 'bg-primary/20 text-primary'}`}>
                  <span className="material-symbols-outlined text-sm">{msg.role === 'user' ? 'person' : 'smart_toy'}</span>
                </div>
                <div className={`rounded-2xl p-4 text-sm leading-relaxed max-w-[85%] ${msg.role === 'user' ? 'bg-primary text-background-dark rounded-tr-none' : 'bg-white/10 text-white/90 rounded-tl-none'}`}>
                  {msg.role === 'user' ? (
                    msg.text
                  ) : (
                    <div className="markdown-body prose prose-invert prose-sm max-w-none">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isChatLoading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-sm">smart_toy</span>
                </div>
                <div className="bg-white/10 rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white/50 animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  <span className="w-2 h-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-white/10 bg-background-dark">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
              className="flex items-center gap-2 glass rounded-full p-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about your performance..."
                className="flex-1 bg-transparent border-none px-4 text-sm text-white focus:outline-none placeholder:text-white/30"
              />
              <button 
                type="submit"
                disabled={!chatInput.trim() || isChatLoading}
                className="w-10 h-10 rounded-full bg-primary text-background-dark flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                <span className="material-symbols-outlined text-xl">send</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
