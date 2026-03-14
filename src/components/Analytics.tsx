import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateAIContent, generateAIContentStream } from '../lib/ai';
import Markdown from 'react-markdown';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '../lib/supabase';

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

  useEffect(() => {
    if (isChatOpen && chatMessages.length === 0 && supabase) {
      const loadChatHistory = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('ai_data')
            .select('data')
            .eq('user_id', user.id)
            .eq('type', 'chat_history')
            .single();
            
          if (error) {
            console.error('Error loading chat history:', error);
            return;
          }
            
          if (data && data.data && Array.isArray(data.data.messages)) {
            setChatMessages(data.data.messages);
          }
        }
      };
      loadChatHistory();
    }
  }, [isChatOpen]);

  const saveChatHistory = async (messages: {role: 'user' | 'model', text: string}[]) => {
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('ai_data').upsert({
          user_id: user.id,
          type: 'chat_history',
          data: { messages }
        }, { onConflict: 'user_id,type' });
        if (error) console.error(error);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput;
    setChatInput('');
    const newMessages = [...chatMessages, { role: 'user' as const, text: userMsg }];
    setChatMessages(newMessages);
    setIsChatLoading(true);
    
    try {
      const context = `
        User Profile: ${JSON.stringify(profile)}
        Targets: ${JSON.stringify(targets)}
        Recent Entries: ${JSON.stringify(entries.slice(0, 20))}
        Current Weight: ${currentWeight}
      `;
      
      const responseStream = await generateAIContentStream({
        model: 'gemini-3-flash-preview',
        contents: `Context: ${context}\n\nUser Question: ${userMsg}\n\nYou are Cal.ai, an intelligent nutrition assistant. Provide a helpful, concise, and encouraging response based on the user's data. Use markdown for formatting.`,
      });
      
      setChatMessages(prev => [...prev, { role: 'model', text: '' }]);
      
      let fullResponse = '';
      for await (const chunk of responseStream) {
        fullResponse += chunk.text;
        setChatMessages(prev => {
          const updatedMessages = [...prev];
          updatedMessages[updatedMessages.length - 1].text = fullResponse;
          return updatedMessages;
        });
      }
      
      // Save after stream completes
      saveChatHistory([...newMessages, { role: 'model', text: fullResponse }]);
      
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessages = [...newMessages, { role: 'model' as const, text: 'Sorry, I encountered an error. Please try again.' }];
      setChatMessages(errorMessages);
      saveChatHistory(errorMessages);
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
    if (supabase) {
      const loadAIData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('ai_data')
            .select('type, data')
            .eq('user_id', user.id)
            .in('type', ['insight', 'deep_analysis']);
            
          if (!error && data) {
            data.forEach(row => {
              if (row.type === 'insight' && !aiInsight && row.data.text) {
                setAiInsight(row.data.text);
              }
              if (row.type === 'deep_analysis' && !deepAnalysis && row.data.text) {
                setDeepAnalysis(row.data.text);
              }
            });
          }
        }
      };
      loadAIData();
    }
  }, [supabase]);

  useEffect(() => {
    const fetchInsight = async () => {
      const currentData = JSON.stringify({ timeRange, efficiencyScore, consumedProtein, goal: profile?.goal });
      const lastData = localStorage.getItem('aiInsightData');
      
      if (aiInsight && lastData === currentData) return;

      setIsInsightLoading(true);
      try {
        const context = `
          Time Range: ${timeRange}
          Efficiency Score: ${efficiencyScore}
          Protein: ${consumedProtein}/${targets.protein}g
          Carbs: ${consumedCarbs}/${targets.carbs}g
          Fats: ${consumedFats}/${targets.fats}g
          Calories: ${consumedCalories}/${targets.calories}kcal
          Goal: ${profile?.goal}
        `;
        const response = await generateAIContent({
          model: 'gemini-3-flash-preview',
          contents: `Context: ${context}\n\nProvide a single, short, punchy sentence (max 15 words) of actionable advice or encouragement based on this nutrition data. Make it specific to their ${profile?.goal} goal.`,
        });
        if (response.text) {
          setAiInsight(response.text);
          localStorage.setItem('aiInsight', response.text);
          localStorage.setItem('aiInsightTime', new Date().getTime().toString());
          localStorage.setItem('aiInsightData', currentData);
          
          if (supabase) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { error: upsertError } = await supabase.from('ai_data').upsert({
                user_id: user.id,
                type: 'insight',
                data: { text: response.text, currentData }
              }, { onConflict: 'user_id,type' });
              if (upsertError) console.error(upsertError);
            }
          }
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
  const [isDeepAnalysisModalOpen, setIsDeepAnalysisModalOpen] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#0f172a', // match background-dark
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Cal_ai_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const fetchDeepAnalysis = async () => {
    setIsDeepAnalyzing(true);
    try {
      const context = `
        User Profile: ${JSON.stringify(profile)}
        Targets: ${JSON.stringify(targets)}
        Entries (Last 30 days): ${JSON.stringify(entries.slice(0, 50))}
        Weight History: ${JSON.stringify(weightHistory)}
        Time Range: ${timeRange}
      `;
      
      const response = await generateAIContent({
        model: 'gemini-3-flash-preview',
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
        
        if (supabase) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { error: upsertError } = await supabase.from('ai_data').upsert({
              user_id: user.id,
              type: 'deep_analysis',
              data: { text: response.text }
            }, { onConflict: 'user_id,type' });
            if (upsertError) console.error(upsertError);
          }
        }
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
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayEntries = entries.filter(e => e.timestamp.startsWith(dateStr) && e.type === 'activity');
      const burn = dayEntries.reduce((sum, e) => sum + Math.abs(e.calories), 0);
      
      days.push({ 
        date: format(d, 'EEE'), // e.g., 'Mon'
        burn,
        fullDate: dateStr
      });
    }
    
    return days;
  }, [entries]);

  const weightChartData = useMemo(() => {
    if (weightHistory.length === 0) return [];
    // Get last 30 days of weight history
    const thirtyDaysAgo = subDays(new Date(), 30);
    return weightHistory
      .filter(w => new Date(w.date) >= thirtyDaysAgo)
      .map(w => ({
        date: format(parseISO(w.date), 'MMM dd'),
        weight: w.weight
      }));
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
            {weightChartData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weightChartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <YAxis domain={['dataMin - 2', 'dataMax + 2']} hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e1b4b', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#8b5cf6', fontWeight: 'bold' }}
                    formatter={(value: number) => [`${value} kg`, 'Weight']}
                  />
                  <Area type="monotone" dataKey="weight" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                Not enough data to show trend
              </div>
            )}
            <div className="flex justify-between mt-2 px-1">
              {weightChartData.length > 0 && (
                <>
                  <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">{weightChartData[0].date}</span>
                  <span className="text-[10px] text-primary font-bold uppercase tracking-widest underline underline-offset-4 decoration-primary/30">Today</span>
                </>
              )}
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
          <div className="h-40 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyActivity} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#1e1b4b', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#8b5cf6', fontWeight: 'bold' }}
                  formatter={(value: number) => [`${value} kcal`, 'Burned']}
                  labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                />
                <Bar dataKey="burn" radius={[4, 4, 4, 4]}>
                  {weeklyActivity.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 6 ? '#8b5cf6' : 'rgba(255,255,255,0.1)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
            <div 
              onClick={() => setIsDeepAnalysisModalOpen(true)}
              className="glass p-6 rounded-2xl border border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors animate-in fade-in slide-in-from-bottom-4 group"
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">auto_awesome</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-primary">Deep Analysis Ready</span>
                </div>
                <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">open_in_new</span>
              </div>
              <p className="text-sm text-slate-300 line-clamp-2">
                Your comprehensive performance report is ready. Tap to view insights, consistency score, and predicted trends.
              </p>
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
      
      {/* Deep Analysis Modal */}
      {isDeepAnalysisModalOpen && deepAnalysis && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background-dark/95 backdrop-blur-xl animate-in fade-in duration-200">
          <header className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-background-dark/90 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full glass flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">analytics</span>
              </div>
              <div>
                <h2 className="text-white font-bold tracking-tight">Performance Report</h2>
                <p className="text-[10px] text-primary uppercase tracking-widest font-semibold">{format(new Date(), 'MMM dd, yyyy')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={downloadPDF} className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-colors text-primary" title="Download PDF">
                <span className="material-symbols-outlined text-xl">download</span>
              </button>
              <button onClick={() => setIsDeepAnalysisModalOpen(false)} className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6 pb-24">
            <div ref={reportRef} className="bg-background-dark p-6 rounded-2xl border border-white/10 shadow-2xl max-w-2xl mx-auto">
              {/* Report Header for PDF */}
              <div className="border-b border-white/10 pb-6 mb-6 text-center">
                <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Cal.ai Deep Analysis</h1>
                <p className="text-sm text-slate-400">Prepared for {profile?.name || 'User'} • {format(new Date(), 'MMMM dd, yyyy')}</p>
              </div>
              
              <div className="markdown-body prose prose-invert prose-sm max-w-none prose-headings:text-primary prose-a:text-primary">
                <Markdown>{deepAnalysis}</Markdown>
              </div>
              
              {/* Report Footer for PDF */}
              <div className="border-t border-white/10 mt-8 pt-6 text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Generated by Cal.ai Intelligence</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
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
          <header className="flex items-center justify-between p-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-sm">auto_awesome</span>
              </div>
              <h2 className="text-white font-medium text-sm">Cal.ai</h2>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-white/70">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 max-w-3xl mx-auto w-full">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-primary text-3xl">auto_awesome</span>
                </div>
                <h3 className="text-2xl font-medium text-white">Hello, {profile?.name || 'there'}</h3>
                <p className="text-white/50 max-w-md">I'm your AI nutrition coach. Ask me about your performance, diet, or how to reach your goals.</p>
              </div>
            ) : (
              <>
                <div className="flex gap-4 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <span className="material-symbols-outlined text-primary text-sm">auto_awesome</span>
                  </div>
                  <div className="text-white/90 text-sm leading-relaxed">
                    Hi! I'm your Cal.ai coach. I've analyzed your {timeRange} performance. Your efficiency score is {efficiencyScore}/100. How can I help you improve today?
                  </div>
                </div>

                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'model' && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                        <span className="material-symbols-outlined text-primary text-sm">auto_awesome</span>
                      </div>
                    )}
                    <div className={`max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'bg-white/10 text-white rounded-3xl rounded-tr-sm px-5 py-3 text-sm leading-relaxed' : 'text-white/90 text-sm leading-relaxed'}`}>
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
                  <div className="flex gap-4 justify-start">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                      <span className="material-symbols-outlined text-primary text-sm">auto_awesome</span>
                    </div>
                    <div className="text-white/50 text-sm leading-relaxed flex items-center gap-1 py-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          <div className="p-4 md:p-6 max-w-3xl mx-auto w-full">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
              className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full p-2 pl-6 focus-within:border-primary/50 focus-within:bg-white/10 transition-all"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask Cal.ai..."
                className="flex-1 bg-transparent border-none text-sm text-white focus:outline-none placeholder:text-white/30"
              />
              <button 
                type="submit"
                disabled={!chatInput.trim() || isChatLoading}
                className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">arrow_upward</span>
              </button>
            </form>
            <p className="text-center text-[10px] text-white/30 mt-3">Cal.ai can make mistakes. Consider verifying important information.</p>
          </div>
        </div>
      )}
    </div>
  );
}
