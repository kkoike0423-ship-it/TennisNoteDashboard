-- Drop existing tables to allow re-running this script
DROP TABLE IF EXISTS public.user_watched_players CASCADE;
DROP TABLE IF EXISTS public.category_rankings CASCADE;
DROP TABLE IF EXISTS public.player_ranking_history CASCADE;
DROP TABLE IF EXISTS public.players CASCADE;

-- 1. Create players table
CREATE TABLE public.players (
    player_id TEXT PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    team TEXT,
    category TEXT,
    gender TEXT,
    school_type TEXT,
    update_ym TEXT,
    ranking_point INTEGER
);

-- 2. Create player_ranking_history table
CREATE TABLE public.player_ranking_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id TEXT REFERENCES public.players(player_id) ON DELETE CASCADE,
    year_month TEXT NOT NULL,
    points_raw INTEGER,
    points_value INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(player_id, year_month) -- Added unique constraint
);

-- 3. Create category_rankings table
CREATE TABLE public.category_rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL,
    player_id TEXT REFERENCES public.players(player_id) ON DELETE CASCADE,
    year_month TEXT NOT NULL,
    rank INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(player_id, category, year_month) -- Added unique constraint
);

-- 4. Create user_watched_players table (for dashboard multi-player graphing limit 20)
CREATE TABLE public.user_watched_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Supabase internal auth ID
    player_id TEXT REFERENCES public.players(player_id) ON DELETE CASCADE,
    player_type TEXT DEFAULT 'managed',
    -- NEW: To which managed player does this opponent belong? NULL for managed players themselves.
    target_managed_player_id TEXT REFERENCES public.players(player_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, player_id, player_type, target_managed_player_id)
);

-- Security: Enable Row Level Security (RLS)
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_ranking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_watched_players ENABLE ROW LEVEL SECURITY;

-- Policies
-- (For now, anyone authenticated can read the common data)
CREATE POLICY "Authenticated users can read players" ON public.players FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read history" ON public.player_ranking_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read category" ON public.category_rankings FOR SELECT USING (auth.role() = 'authenticated');

-- Players can be managed by any authenticated user (needed for UPSERT during upload)
CREATE POLICY "Authenticated users can manage players" ON public.players FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage history" ON public.player_ranking_history FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage category" ON public.category_rankings FOR ALL USING (auth.role() = 'authenticated');

-- Users can only read, insert, delete their own watched list
CREATE POLICY "Users can fully manage their watched list" ON public.user_watched_players FOR ALL USING (auth.uid() = user_id);
