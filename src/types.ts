export type Goal = 'loss' | 'maintain' | 'gain';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';

export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface UserProfile {
  name: string;
  goal: Goal;
  activityLevel: ActivityLevel;
  age: number;
  height: number; // cm
  weight: number; // kg
  targetWeight?: number; // kg
}

export interface MacroTarget {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface Entry {
  id: string;
  type: 'food' | 'activity';
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  timestamp: string; // ISO string
  category?: string;
}

export interface WeightEntry {
  date: string; // YYYY-MM-DD
  weight: number;
}
