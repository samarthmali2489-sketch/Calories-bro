import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Goal, ActivityLevel, UserProfile } from '../types';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { setProfile, completeOnboarding } = useAppContext();
  const [step, setStep] = useState(1);
  
  const [goal, setGoal] = useState<Goal>('loss');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [name, setName] = useState('');
  const [age, setAge] = useState('25');
  const [height, setHeight] = useState('175');
  const [weight, setWeight] = useState('70');

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      const profile: UserProfile = {
        name: name || 'User',
        goal,
        activityLevel,
        age: parseInt(age) || 25,
        height: parseInt(height) || 175,
        weight: parseFloat(weight) || 70,
      };
      setProfile(profile);
      completeOnboarding();
      onComplete();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden max-w-md mx-auto">
      <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]"></div>
      <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]"></div>
      
      <header className="relative z-10 flex items-center justify-between p-6">
        <button 
          onClick={handleBack}
          className={`flex size-10 items-center justify-center rounded-full glass-button text-slate-100 ${step === 1 ? 'opacity-0 pointer-events-none' : ''}`}
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="text-xl font-bold tracking-tight text-primary">Cal.ai</div>
        <div className="size-10"></div>
      </header>
      
      <div className="relative z-10 flex flex-col gap-3 px-8 pt-4">
        <div className="flex justify-between items-end">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Step 0{step}</span>
          <span className="text-xs font-medium text-slate-500">{step} of 4</span>
        </div>
        <div className="h-[3px] w-full rounded-full bg-white/10 overflow-hidden">
          <div className="glow-progress h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(step / 4) * 100}%` }}></div>
        </div>
      </div>
      
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 pb-12">
        {step === 1 && (
          <>
            <div className="max-w-md w-full text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary mb-4">
                What's your goal?
              </h1>
              <p className="text-slate-400 text-lg font-light leading-relaxed">
                We'll tailor your nutrition and activity targets based on your path.
              </p>
            </div>
            
            <div className="grid w-full max-w-md gap-4">
              {[
                { id: 'loss', icon: 'mode_fan', title: 'Weight Loss', desc: 'Burn fat and get leaner' },
                { id: 'maintain', icon: 'balance', title: 'Maintain Weight', desc: 'Stay at your current weight' },
                { id: 'gain', icon: 'fitness_center', title: 'Muscle Gain', desc: 'Build strength and size' }
              ].map((item) => (
                <label key={item.id} className="relative group cursor-pointer">
                  <input 
                    checked={goal === item.id} 
                    onChange={() => setGoal(item.id as Goal)}
                    className="peer sr-only" 
                    name="goal" 
                    type="radio" 
                    value={item.id} 
                  />
                  <div className="glass-button flex items-center gap-5 p-6 rounded-2xl border-white/10 peer-checked:border-primary peer-checked:bg-white/10 transition-all duration-300">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/5 text-primary">
                      <span className="material-symbols-outlined">{item.icon}</span>
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-lg font-semibold text-primary">{item.title}</span>
                      <span className="text-sm text-slate-400">{item.desc}</span>
                    </div>
                    <div className="ml-auto opacity-0 peer-checked:opacity-100 transition-opacity">
                      <span className="material-symbols-outlined text-primary">check_circle</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="max-w-md w-full text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary mb-4">
                Activity Level?
              </h1>
              <p className="text-slate-400 text-lg font-light leading-relaxed">
                How active are you on an average day?
              </p>
            </div>
            
            <div className="grid w-full max-w-md gap-4">
              {[
                { id: 'sedentary', icon: 'chair', title: 'Sedentary', desc: 'Little to no exercise' },
                { id: 'light', icon: 'directions_walk', title: 'Lightly Active', desc: 'Light exercise 1-3 days/week' },
                { id: 'moderate', icon: 'directions_run', title: 'Moderately Active', desc: 'Moderate exercise 3-5 days/week' },
                { id: 'active', icon: 'sprint', title: 'Very Active', desc: 'Hard exercise 6-7 days/week' }
              ].map((item) => (
                <label key={item.id} className="relative group cursor-pointer">
                  <input 
                    checked={activityLevel === item.id} 
                    onChange={() => setActivityLevel(item.id as ActivityLevel)}
                    className="peer sr-only" 
                    name="activity" 
                    type="radio" 
                    value={item.id} 
                  />
                  <div className="glass-button flex items-center gap-5 p-4 rounded-2xl border-white/10 peer-checked:border-primary peer-checked:bg-white/10 transition-all duration-300">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-primary">
                      <span className="material-symbols-outlined">{item.icon}</span>
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-base font-semibold text-primary">{item.title}</span>
                      <span className="text-xs text-slate-400">{item.desc}</span>
                    </div>
                    <div className="ml-auto opacity-0 peer-checked:opacity-100 transition-opacity">
                      <span className="material-symbols-outlined text-primary">check_circle</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="max-w-md w-full text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary mb-4">
                Your Details
              </h1>
              <p className="text-slate-400 text-lg font-light leading-relaxed">
                Help us calculate your precise metabolic rate.
              </p>
            </div>
            
            <div className="w-full max-w-md space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">Age (years)</label>
                <input 
                  type="number" 
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-xl text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="25"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">Height (cm)</label>
                <input 
                  type="number" 
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-xl text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="175"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">Weight (kg)</label>
                <input 
                  type="number" 
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-xl text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="70"
                />
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="max-w-md w-full text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary mb-4">
                What's your name?
              </h1>
              <p className="text-slate-400 text-lg font-light leading-relaxed">
                Let's make this personal.
              </p>
            </div>
            
            <div className="w-full max-w-md">
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-5 text-2xl text-center text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="Alex"
                autoFocus
              />
            </div>
          </>
        )}
      </main>
      
      <footer className="relative z-10 p-8 pb-12 flex flex-col items-center">
        <button 
          onClick={handleNext}
          className="w-full max-w-md bg-primary text-background-dark font-bold py-5 rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all shadow-xl shadow-white/10"
        >
          {step === 4 ? 'Complete Setup' : 'Continue'}
        </button>
        <p className="mt-6 text-xs text-slate-500 font-medium uppercase tracking-[0.2em]">
          Secure & Private Onboarding
        </p>
      </footer>
      
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] pointer-events-none opacity-[0.02]" 
        style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      >
      </div>
    </div>
  );
}
