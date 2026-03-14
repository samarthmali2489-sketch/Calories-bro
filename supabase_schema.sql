-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    name TEXT,
    goal TEXT,
    activity_level TEXT,
    age INTEGER,
    height FLOAT,
    weight FLOAT,
    is_onboarded BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create entries table
CREATE TABLE IF NOT EXISTS public.entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL, -- 'food' or 'exercise'
    name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    protein INTEGER,
    carbs INTEGER,
    fats INTEGER,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    category TEXT, -- 'breakfast', 'lunch', 'dinner', 'snack'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create weight_history table
CREATE TABLE IF NOT EXISTS public.weight_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    weight FLOAT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_history ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Profiles: Users can only read/write their own profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Entries: Users can only read/write their own entries
CREATE POLICY "Users can view own entries" ON public.entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own entries" ON public.entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own entries" ON public.entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own entries" ON public.entries FOR DELETE USING (auth.uid() = user_id);

-- Weight History: Users can only read/write their own weight history
CREATE POLICY "Users can view own weight history" ON public.weight_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weight history" ON public.weight_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weight history" ON public.weight_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own weight history" ON public.weight_history FOR DELETE USING (auth.uid() = user_id);

-- Create ai_data table for caching AI responses and chat history
CREATE TABLE IF NOT EXISTS public.ai_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL, -- 'insight', 'deep_analysis', 'chat_history'
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, type)
);

-- Enable RLS for ai_data
ALTER TABLE public.ai_data ENABLE ROW LEVEL SECURITY;

-- Create policies for ai_data
CREATE POLICY "Users can view own ai_data" ON public.ai_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai_data" ON public.ai_data FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ai_data" ON public.ai_data FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ai_data" ON public.ai_data FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name)
    VALUES (new.id, new.raw_user_meta_data->>'name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
