import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { GoogleGenAI, Type } from '@google/genai';

interface ScannerProps {
  onNavigate: (screen: string) => void;
}

export default function Scanner({ onNavigate }: ScannerProps) {
  const { addEntry } = useAppContext();
  const [showManual, setShowManual] = useState(false);
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');
  const [type, setType] = useState<'food' | 'activity'>('food');

  const [contextDetails, setContextDetails] = useState('');
  const [contextAmount, setContextAmount] = useState('');
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [showContextForm, setShowContextForm] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scannedFood, setScannedFood] = useState<{
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  } | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isFlashlightOn, setIsFlashlightOn] = useState(false);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    return () => {
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
      }
    };
  }, []);

  const toggleFlashlight = async () => {
    try {
      if (!videoTrackRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        videoTrackRef.current = stream.getVideoTracks()[0];
      }

      const track = videoTrackRef.current;
      const capabilities = track.getCapabilities() as any;
      
      if (capabilities.torch) {
        await track.applyConstraints({
          advanced: [{ torch: !isFlashlightOn }]
        } as any);
        setIsFlashlightOn(!isFlashlightOn);
      } else {
        alert('Flashlight is not supported on this device.');
      }
    } catch (err) {
      console.error('Error accessing flashlight:', err);
      alert('Could not access the camera/flashlight. Please ensure permissions are granted.');
    }
  };

  const handleEditManually = () => {
    if (scannedFood) {
      setName(scannedFood.name);
      setCalories(scannedFood.calories.toString());
      setProtein(scannedFood.protein.toString());
      setCarbs(scannedFood.carbs.toString());
      setFats(scannedFood.fats.toString());
      setType('food');
    }
    setShowManual(true);
  };

  const handleLogMeal = () => {
    if (scannedFood) {
      addEntry({
        id: crypto.randomUUID(),
        type: 'food',
        name: scannedFood.name,
        calories: scannedFood.calories,
        protein: scannedFood.protein,
        carbs: scannedFood.carbs,
        fats: scannedFood.fats,
        timestamp: new Date().toISOString(),
        category: 'Meal'
      });
      onNavigate('dashboard');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && calories) {
      addEntry({
        id: crypto.randomUUID(),
        type,
        name,
        calories: type === 'activity' ? -Math.abs(Number(calories)) : Number(calories),
        protein: protein ? Number(protein) : undefined,
        carbs: carbs ? Number(carbs) : undefined,
        fats: fats ? Number(fats) : undefined,
        timestamp: new Date().toISOString(),
        category: type === 'activity' ? 'Activity' : 'Custom'
      });
      onNavigate('dashboard');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create a preview URL
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setPendingImageFile(file);
    setShowContextForm(true);
    setScannedFood(null);
  };

  const analyzeImage = async () => {
    if (!pendingImageFile) return;
    
    setIsAnalyzing(true);
    setShowContextForm(false);

    try {
      const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 1024;
              const MAX_HEIGHT = 1024;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              resolve(dataUrl.split(',')[1]);
            };
            img.onerror = (error) => reject(error);
          };
          reader.onerror = (error) => reject(error);
        });
      };

      const base64String = await compressImage(pendingImageFile);

      // Call Gemini API
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64String,
              },
            },
            {
              text: `Analyze this food image and provide the nutritional breakdown. Estimate the portion size from the image. ${
                contextDetails || contextAmount 
                  ? `The user provided this additional context: ${contextDetails ? 'Dish Name: ' + contextDetails + '. ' : ''}${contextAmount ? 'Quantity/Ingredients breakdown: ' + contextAmount + '.' : ''} Please strictly use this context to calculate a highly accurate nutritional breakdown, especially if specific weights or ingredients are provided.` 
                  : ''
              }`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: 'Name of the food' },
              calories: { type: Type.INTEGER, description: 'Estimated total calories' },
              protein: { type: Type.INTEGER, description: 'Estimated protein in grams' },
              carbs: { type: Type.INTEGER, description: 'Estimated carbohydrates in grams' },
              fats: { type: Type.INTEGER, description: 'Estimated fats in grams' },
            },
            required: ['name', 'calories', 'protein', 'carbs', 'fats'],
          },
        },
      });

      if (response.text) {
        const result = JSON.parse(response.text);
        setScannedFood(result);
      }
      setIsAnalyzing(false);
      setPendingImageFile(null);
    } catch (error) {
      console.error('Error analyzing image:', error);
      setIsAnalyzing(false);
      setPendingImageFile(null);
      alert('Failed to analyze image. Please try again.');
    }
  };

  if (showManual) {
    return (
      <div className="relative min-h-[100dvh] w-full max-w-md mx-auto bg-background-dark p-6 overflow-y-auto pb-24">
        <header className="flex items-center justify-between mb-8 pt-2">
          <button onClick={() => setShowManual(false)} className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold tracking-tight text-primary">Manual Entry</h1>
          <div className="w-10"></div>
        </header>

        <form onSubmit={handleManualSubmit} className="space-y-6">
          <div className="flex bg-white/5 p-1 rounded-xl">
            <button 
              type="button"
              onClick={() => setType('food')} 
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${type === 'food' ? 'bg-primary text-background-dark' : 'text-slate-400'}`}
            >
              Food
            </button>
            <button 
              type="button"
              onClick={() => setType('activity')} 
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${type === 'activity' ? 'bg-primary text-background-dark' : 'text-slate-400'}`}
            >
              Activity
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
                placeholder={type === 'food' ? "e.g. Chicken Salad" : "e.g. Running"}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Calories (kcal)</label>
              <input
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="e.g. 350"
                required
              />
            </div>

            {type === 'food' && (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Protein (g)</label>
                  <input
                    type="number"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Carbs (g)</label>
                  <input
                    type="number"
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Fats (g)</label>
                  <input
                    type="number"
                    value={fats}
                    onChange={(e) => setFats(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
                    placeholder="0"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-primary text-background-dark font-bold rounded-xl py-3.5 mt-6 hover:bg-white transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            Save Entry
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full max-w-md mx-auto overflow-hidden bg-background-dark">
      
      {/* Animated Gradient Background */}
      {!imageUrl && (
        <div className="absolute inset-0 bg-gradient-to-br from-background-dark via-primary/10 to-background-dark animate-gradient-slow bg-[length:200%_200%]"></div>
      )}
      
      {/* Image Background */}
      {imageUrl && (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${imageUrl}')` }}></div>
      )}
      
      {/* Dark Overlay for better UI contrast */}
      <div className="absolute inset-0 bg-black/30"></div>
      
      {/* Header Controls */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-6 z-20">
        <button onClick={() => onNavigate('dashboard')} className="flex items-center justify-center size-10 rounded-full bg-black/20 backdrop-blur-md border border-white/10">
          <span className="material-symbols-outlined text-white">close</span>
        </button>
        <div className="px-4 py-1.5 rounded-full bg-black/20 backdrop-blur-md border border-white/10">
          <h2 className="text-white text-sm font-semibold tracking-widest uppercase">Cal.ai</h2>
        </div>
        <button 
          onClick={toggleFlashlight}
          className={`flex items-center justify-center size-10 rounded-full backdrop-blur-md border transition-colors ${isFlashlightOn ? 'bg-white text-black border-white' : 'bg-black/20 text-white border-white/10'}`}
        >
          <span className="material-symbols-outlined">{isFlashlightOn ? 'flashlight_off' : 'flashlight_on'}</span>
        </button>
      </div>
      
      {/* Scanning HUD / Brackets */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-72 h-72">
          {/* Top Left Bracket */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 viewport-bracket"></div>
          {/* Top Right Bracket */}
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 viewport-bracket"></div>
          {/* Bottom Left Bracket */}
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 viewport-bracket"></div>
          {/* Bottom Right Bracket */}
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 viewport-bracket"></div>
          
          {isAnalyzing && (
            <>
              {/* Scanning Glow Line */}
              <div className="scan-line w-full absolute top-[40%] h-[2px]"></div>
              
              {/* Status Tag */}
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full bg-white text-black text-[10px] font-bold tracking-tighter uppercase">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-black"></span>
                </span>
                Analyzing Frame
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Bottom UI Section */}
      <div className="absolute bottom-0 left-0 right-0 p-6 space-y-6 z-20">
        
        {/* Context Form (After Image Upload) */}
        {showContextForm && (
          <div className="glass-pane rounded-2xl p-6 shadow-2xl border border-white/10 animate-in slide-in-from-bottom-4">
            <h3 className="text-white font-bold text-lg mb-2">Dish Details</h3>
            <p className="text-xs text-white/60 mb-4">Help the AI identify complex dishes and exact portions for better accuracy.</p>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Dish Name (Optional)</label>
                <input
                  type="text"
                  value={contextDetails}
                  onChange={(e) => setContextDetails(e.target.value)}
                  placeholder="e.g. Chicken Biryani"
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Quantity / Details (Optional)</label>
                <input
                  type="text"
                  value={contextAmount}
                  onChange={(e) => setContextAmount(e.target.value)}
                  placeholder="e.g. 500 gm (400 gm rice, 100 gm chicken)"
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => {
                    setShowContextForm(false);
                    setImageUrl(null);
                    setPendingImageFile(null);
                  }} 
                  className="flex-1 py-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 transition-colors text-white text-xs font-bold tracking-widest uppercase"
                >
                  Cancel
                </button>
                <button 
                  onClick={analyzeImage} 
                  className="flex-[2] py-3 rounded-xl bg-primary text-background-dark text-xs font-bold tracking-widest uppercase hover:bg-white transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                >
                  Analyze Food
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Food Identification Card (Glass Pane) */}
        {scannedFood && (
          <div className="glass-pane rounded-2xl p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <span className="text-[10px] font-bold text-white/50 tracking-widest uppercase mb-1 block">Identification</span>
                <h3 className="text-white text-2xl font-light tracking-tight">{scannedFood.name}</h3>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/10">
                <span className="text-white text-xs font-medium">Analyzed</span>
              </div>
            </div>
            
            {/* Nutritional Breakdown */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="space-y-1">
                <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Calories</p>
                <p className="text-white text-lg font-light">{scannedFood.calories} <span className="text-[10px] opacity-40">kcal</span></p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Protein</p>
                <p className="text-white text-lg font-light">{scannedFood.protein}<span className="text-[10px] opacity-40">g</span></p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Fat</p>
                <p className="text-white text-lg font-light">{scannedFood.fats}<span className="text-[10px] opacity-40">g</span></p>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3 mt-2">
              <button onClick={handleEditManually} className="flex-1 h-14 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 transition-colors text-white text-xs font-bold tracking-widest uppercase">
                Edit Manually
              </button>
              <button onClick={handleLogMeal} className="flex-[2] h-14 rounded-xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-white/90 backdrop-blur-md group-active:bg-white/100 transition-colors"></div>
                <div className="absolute inset-0 border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]"></div>
                <span className="relative text-black text-sm font-bold tracking-widest uppercase">Log Meal</span>
              </button>
            </div>
          </div>
        )}
        
        {/* Secondary Controls */}
        {!showContextForm && !scannedFood && !isAnalyzing && (
          <div className="flex items-center justify-between px-4">
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImageUpload}
            />
            <input 
              type="file" 
              accept="image/*" 
              capture="environment"
              className="hidden" 
              ref={cameraInputRef}
              onChange={handleImageUpload}
            />
            <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 group">
              <div className="size-12 rounded-full border border-white/20 flex items-center justify-center bg-black/20 group-hover:bg-white/10 transition-all">
                <span className="material-symbols-outlined text-white">image</span>
              </div>
              <span className="text-[10px] text-white/60 font-medium uppercase tracking-widest">Library</span>
            </button>
            
            <div className="relative">
              <button onClick={() => cameraInputRef.current?.click()} className="size-16 rounded-full border-4 border-white flex items-center justify-center p-1 hover:scale-105 transition-transform">
                <div className="size-full rounded-full bg-white/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white">photo_camera</span>
                </div>
              </button>
            </div>
            
            <button onClick={() => setShowManual(true)} className="flex flex-col items-center gap-2 group">
              <div className="size-12 rounded-full border border-white/20 flex items-center justify-center bg-black/20 group-hover:bg-white/10 transition-all">
                <span className="material-symbols-outlined text-white">edit</span>
              </div>
              <span className="text-[10px] text-white/60 font-medium uppercase tracking-widest">Manual</span>
            </button>
          </div>
        )}
        
        {/* Bottom Nav Bar */}
        <div className="flex items-center justify-between px-8 py-2 bg-black/40 backdrop-blur-xl border border-white/5 rounded-full mx-4">
          <button onClick={() => onNavigate('dashboard')} className="p-2 text-white/40 hover:text-white transition-colors">
            <span className="material-symbols-outlined">home</span>
          </button>
          <button className="p-2 text-white">
            <span className="material-symbols-outlined fill-1">crop_free</span>
          </button>
          <button onClick={() => onNavigate('analytics')} className="p-2 text-white/40 hover:text-white transition-colors">
            <span className="material-symbols-outlined">analytics</span>
          </button>
          <button onClick={() => onNavigate('profile')} className="p-2 text-white/40 hover:text-white transition-colors">
            <span className="material-symbols-outlined">person</span>
          </button>
        </div>
      </div>
    </div>
  );
}
