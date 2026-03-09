import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, MacroTarget, Entry, WeightEntry, User } from '../types';
import { supabase } from '../lib/supabase';

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
  const [targets, setTargets] = useState<MacroTarget>(defaultTargets);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    if (profile) {
      let bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
      
      let multiplier = 1.2;
      if (profile.activityLevel === 'light') multiplier = 1.375;
      if (profile.activityLevel === 'moderate') multiplier = 1.55;
      if (profile.activityLevel === 'active') multiplier = 1.725;

      let tdee = bmr * multiplier;

      if (profile.goal === 'loss') tdee -= 500;
      if (profile.goal === 'gain') tdee += 300;

      const calories = Math.round(tdee);
      const protein = Math.round(profile.weight * 2.2);
      const fats = Math.round((calories * 0.25) / 9);
      const carbs = Math.round((calories - (protein * 4) - (fats * 9)) / 4);

      setTargets({ calories, protein, carbs, fats });
    }
  }, [profile]);

  const setProfile = async (newProfile: UserProfile) => {
    setProfileState(newProfile);
    if (user) {
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
    if (user) {
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

    if (user) {
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
    if (user) {
      await supabase.from('profiles').update({ is_onboarded: true }).eq('id', user.id);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
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
      loading
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
