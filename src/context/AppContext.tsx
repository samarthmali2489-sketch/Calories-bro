import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { UserProfile, MacroTarget, Entry, WeightEntry, User, AppNotification } from '../types';
import { supabase } from '../lib/supabase';
import { generateAIContent } from '../lib/ai';
import { Type } from '@google/genai';

interface AppState {
  user: User | null;
  logout: () => void;
  profile: UserProfile | null;
  setProfile: (profile: UserProfile) => void;
  entries: Entry[];
  addEntry: (entry: Entry) => void;
  targets: MacroTarget;
  weightHistory: WeightEntry[];
  addWeight: (weight: number, date: string) => void;
  isOnboarded: boolean;
  completeOnboarding: () => void;
  loading: boolean;
  notifications: AppNotification[];
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;
  isSupabaseConfigured: boolean;
}

const defaultTargets: MacroTarget = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fats: 65,
};

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [entries, setEntriesState] = useState<Entry[]>([]);
  const [weightHistory, setWeightHistoryState] = useState<WeightEntry[]>([]);
  const [isOnboarded, setIsOnboardedState] = useState(false);
  const [targets, setTargets] = useState<MacroTarget>(() => {
    const cached = localStorage.getItem('macroTargets');
    return cached ? JSON.parse(cached) : defaultTargets;
  });
  const [loading, setLoading] = useState(true);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [clearedNotificationIds, setClearedNotificationIds] = useState<string[]>([]);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(!!supabase);

  useEffect(() => {
    if (!supabase) {
      setIsSupabaseConfigured(false);
      setLoading(false);
      return;
    }
    const read = localStorage.getItem('readNotifications');
    if (read) setReadNotificationIds(JSON.parse(read));
    const cleared = localStorage.getItem('clearedNotifications');
    if (cleared) setClearedNotificationIds(JSON.parse(cleared));
  }, []);

  const markNotificationAsRead = (id: string) => {
    if (!readNotificationIds.includes(id)) {
      const newRead = [...readNotificationIds, id];
      setReadNotificationIds(newRead);
      localStorage.setItem('readNotifications', JSON.stringify(newRead));
    }
  };

  const clearAllNotifications = () => {
    const allIds = notifications.map(n => n.id);
    const newCleared = [...new Set([...clearedNotificationIds, ...allIds])];
    setClearedNotificationIds(newCleared);
    localStorage.setItem('clearedNotifications', JSON.stringify(newCleared));
  };

  const notifications = useMemo(() => {
    if (!profile) return [];
    
    const notifs: AppNotification[] = [];
    const today = new Date().toISOString().split('T')[0];
    const todaysEntries = entries.filter(e => e.timestamp.startsWith(today));
    
    // 1. No meals logged today
    if (todaysEntries.length === 0 && new Date().getHours() > 10) {
      notifs.push({
        id: `no-meals-${today}`,
        title: "Don't forget to log!",
        message: "You haven't logged any meals today. Keep your streak going!",
        timestamp: new Date().toISOString(),
        read: false,
        type: 'alert'
      });
    }

    // 2. Calorie limit
    const consumedCalories = todaysEntries.filter(e => e.type === 'food').reduce((sum, e) => sum + e.calories, 0);
    if (consumedCalories > targets.calories * 0.9 && consumedCalories <= targets.calories) {
      notifs.push({
        id: `cal-limit-${today}`,
        title: "Approaching Calorie Limit",
        message: `You are at ${Math.round((consumedCalories/targets.calories)*100)}% of your daily calorie goal.`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'info'
      });
    }

    // 3. Hit protein goal
    const consumedProtein = todaysEntries.reduce((sum, e) => sum + (e.protein || 0), 0);
    if (consumedProtein >= targets.protein && targets.protein > 0) {
      notifs.push({
        id: `protein-goal-${today}`,
        title: "Protein Goal Met! 🎉",
        message: "Great job! You've hit your daily protein target.",
        timestamp: new Date().toISOString(),
        read: false,
        type: 'success'
      });
    }

    // 4. Weight reminder
    const lastWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1] : null;
    if (!lastWeight || (new Date().getTime() - new Date(lastWeight.date).getTime()) > 7 * 24 * 60 * 60 * 1000) {
      notifs.push({
        id: `weight-reminder-${today}`,
        title: "Time for a weigh-in",
        message: "It's been a while since you logged your weight. Update it to track your progress!",
        timestamp: new Date().toISOString(),
        read: false,
        type: 'info'
      });
    }
    
    // 5. Welcome notification
    notifs.push({
      id: `welcome-notif`,
      title: "Welcome to Cal.ai",
      message: "Your AI-powered nutrition journey begins here. Try scanning a meal!",
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      read: false,
      type: 'info'
    });

    // Filter out cleared ones and mark read ones
    return notifs
      .filter(n => !clearedNotificationIds.includes(n.id))
      .map(n => ({ ...n, read: readNotificationIds.includes(n.id) }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [profile, entries, targets, weightHistory, readNotificationIds, clearedNotificationIds]);

  useEffect(() => {
    if (!supabase) return;

    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || '', name: session.user.user_metadata?.name });
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || '', name: session.user.user_metadata?.name });
        fetchUserData(session.user.id);
      } else {
        setUser(null);
        setProfileState(null);
        setEntriesState([]);
        setWeightHistoryState([]);
        setIsOnboardedState(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    if (!supabase) return;
    setLoading(true);
    try {
      // Fetch Profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        setProfileState({
          name: profileData.name,
          goal: profileData.goal,
          activityLevel: profileData.activity_level,
          age: profileData.age,
          height: profileData.height,
          weight: profileData.weight,
        });
        if (profileData.targets) {
          setTargets(profileData.targets);
        }
        setIsOnboardedState(profileData.is_onboarded || false);
      }

      // Fetch Entries
      const { data: entriesData } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (entriesData) {
        setEntriesState(entriesData as Entry[]);
      }

      // Fetch Weight History
      const { data: weightData } = await supabase
        .from('weight_history')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true });

      if (weightData) {
        setWeightHistoryState(weightData as WeightEntry[]);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const calculateTargets = async () => {
      if (!profile) return;

      // Check if we have cached targets for this specific profile to avoid redundant AI calls
      const profileKey = JSON.stringify({
        goal: profile.goal,
        activity: profile.activityLevel,
        age: profile.age,
        height: profile.height,
        weight: profile.weight
      });
      const cachedProfileKey = localStorage.getItem('lastProfileKey');
      
      if (cachedProfileKey === profileKey && targets !== defaultTargets) {
        return;
      }

      // Fallback formula
      let bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
      let multiplier = 1.2;
      if (profile.activityLevel === 'light') multiplier = 1.375;
      if (profile.activityLevel === 'moderate') multiplier = 1.55;
      if (profile.activityLevel === 'active') multiplier = 1.725;
      let tdee = bmr * multiplier;
      if (profile.goal === 'loss') tdee -= 500;
      if (profile.goal === 'gain') tdee += 300;

      const fallbackCalories = Math.round(tdee);
      const fallbackProtein = Math.round(profile.weight * 2.2);
      const fallbackFats = Math.round((fallbackCalories * 0.25) / 9);
      const fallbackCarbs = Math.round((fallbackCalories - (fallbackProtein * 4) - (fallbackFats * 9)) / 4);

      try {
        const response = await generateAIContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: `User Profile: ${JSON.stringify(profile)}\n\nCalculate the optimal daily calorie and macro targets (protein, carbs, fats) for this user based on their profile and goal. Provide the results in JSON format.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                calories: { type: Type.INTEGER },
                protein: { type: Type.INTEGER },
                carbs: { type: Type.INTEGER },
                fats: { type: Type.INTEGER },
              },
              required: ['calories', 'protein', 'carbs', 'fats'],
            },
          },
        });

        if (response.text) {
          const aiTargets = JSON.parse(response.text);
          setTargets(aiTargets);
          localStorage.setItem('macroTargets', JSON.stringify(aiTargets));
          localStorage.setItem('lastProfileKey', profileKey);
          
          // Save to Supabase if user is logged in
          if (user && supabase) {
            await supabase.from('profiles').update({ targets: aiTargets }).eq('id', user.id);
          }
        } else {
          const fb = { calories: fallbackCalories, protein: fallbackProtein, carbs: fallbackCarbs, fats: fallbackFats };
          setTargets(fb);
          localStorage.setItem('macroTargets', JSON.stringify(fb));
          localStorage.setItem('lastProfileKey', profileKey);
        }
      } catch (e) {
        console.error('AI target calculation error:', e);
        const fb = { calories: fallbackCalories, protein: fallbackProtein, carbs: fallbackCarbs, fats: fallbackFats };
        setTargets(fb);
        localStorage.setItem('macroTargets', JSON.stringify(fb));
        localStorage.setItem('lastProfileKey', profileKey);
      }
    };

    calculateTargets();
  }, [profile]);

  const setProfile = async (newProfile: UserProfile) => {
    setProfileState(newProfile);
    if (user && supabase) {
      await supabase.from('profiles').upsert({
        id: user.id,
        name: newProfile.name,
        goal: newProfile.goal,
        activity_level: newProfile.activityLevel,
        age: newProfile.age,
        height: newProfile.height,
        weight: newProfile.weight,
        is_onboarded: true // Force to true when setting profile to avoid race condition
      });
      setIsOnboardedState(true);
    }
  };

  const addEntry = async (entry: Entry) => {
    setEntriesState(prev => [entry, ...prev].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    if (user && supabase) {
      await supabase.from('entries').insert({
        id: entry.id,
        user_id: user.id,
        type: entry.type,
        name: entry.name,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fats: entry.fats,
        timestamp: entry.timestamp,
        category: entry.category
      });
    }
  };

  const addWeight = async (weight: number, date: string) => {
    setWeightHistoryState(prev => {
      const existing = prev.find(w => w.date === date);
      if (existing) {
        return prev.map(w => w.date === date ? { ...w, weight } : w);
      }
      return [...prev, { date, weight }].sort((a, b) => a.date.localeCompare(b.date));
    });
    
    if (profile) {
      setProfileState({ ...profile, weight });
    }

    if (user && supabase) {
      // Check if weight entry exists for date
      const { data } = await supabase.from('weight_history').select('id').eq('user_id', user.id).eq('date', date).single();
      
      if (data) {
        await supabase.from('weight_history').update({ weight }).eq('id', data.id);
      } else {
        await supabase.from('weight_history').insert({
          user_id: user.id,
          date,
          weight
        });
      }

      // Update profile weight
      await supabase.from('profiles').update({ weight }).eq('id', user.id);
    }
  };

  const completeOnboarding = async () => {
    setIsOnboardedState(true);
    if (user && supabase) {
      await supabase.from('profiles').update({ is_onboarded: true }).eq('id', user.id);
    }
  };

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  return (
    <AppContext.Provider value={{
      user,
      logout,
      profile,
      setProfile,
      entries,
      addEntry,
      targets,
      weightHistory,
      addWeight,
      isOnboarded,
      completeOnboarding,
      loading,
      notifications,
      markNotificationAsRead,
      clearAllNotifications,
      isSupabaseConfigured
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
