CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Safe schema setup for existing environments.
-- This script avoids dropping tables or deleting data.

-- 1. players
CREATE TABLE IF NOT EXISTS public.players (
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

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS team TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS school_type TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS update_ym TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS ranking_point INTEGER;

-- 2. player_ranking_history
CREATE TABLE IF NOT EXISTS public.player_ranking_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id TEXT REFERENCES public.players(player_id) ON DELETE CASCADE,
    year_month TEXT NOT NULL,
    points_raw INTEGER,
    points_value INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.player_ranking_history ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4();
ALTER TABLE public.player_ranking_history ADD COLUMN IF NOT EXISTS player_id TEXT;
ALTER TABLE public.player_ranking_history ADD COLUMN IF NOT EXISTS year_month TEXT;
ALTER TABLE public.player_ranking_history ADD COLUMN IF NOT EXISTS points_raw INTEGER;
ALTER TABLE public.player_ranking_history ADD COLUMN IF NOT EXISTS points_value INTEGER;
ALTER TABLE public.player_ranking_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.player_ranking_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'player_ranking_history_player_id_fkey'
    ) THEN
        ALTER TABLE public.player_ranking_history
        ADD CONSTRAINT player_ranking_history_player_id_fkey
        FOREIGN KEY (player_id) REFERENCES public.players(player_id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS player_ranking_history_player_id_year_month_idx
ON public.player_ranking_history (player_id, year_month);

-- 3. category_rankings
CREATE TABLE IF NOT EXISTS public.category_rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL,
    player_id TEXT REFERENCES public.players(player_id) ON DELETE CASCADE,
    year_month TEXT NOT NULL,
    rank INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.category_rankings ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4();
ALTER TABLE public.category_rankings ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.category_rankings ADD COLUMN IF NOT EXISTS player_id TEXT;
ALTER TABLE public.category_rankings ADD COLUMN IF NOT EXISTS year_month TEXT;
ALTER TABLE public.category_rankings ADD COLUMN IF NOT EXISTS rank INTEGER;
ALTER TABLE public.category_rankings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.category_rankings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'category_rankings_player_id_fkey'
    ) THEN
        ALTER TABLE public.category_rankings
        ADD CONSTRAINT category_rankings_player_id_fkey
        FOREIGN KEY (player_id) REFERENCES public.players(player_id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS category_rankings_player_id_category_year_month_idx
ON public.category_rankings (player_id, category, year_month);

-- 4. user_watched_players
CREATE TABLE IF NOT EXISTS public.user_watched_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    player_id TEXT REFERENCES public.players(player_id) ON DELETE CASCADE,
    player_type TEXT DEFAULT 'managed',
    target_managed_player_id TEXT REFERENCES public.players(player_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.user_watched_players ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4();
ALTER TABLE public.user_watched_players ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.user_watched_players ADD COLUMN IF NOT EXISTS player_id TEXT;
ALTER TABLE public.user_watched_players ADD COLUMN IF NOT EXISTS player_type TEXT DEFAULT 'managed';
ALTER TABLE public.user_watched_players ADD COLUMN IF NOT EXISTS target_managed_player_id TEXT;
ALTER TABLE public.user_watched_players ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_watched_players_user_id_fkey'
    ) THEN
        ALTER TABLE public.user_watched_players
        ADD CONSTRAINT user_watched_players_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_watched_players_player_id_fkey'
    ) THEN
        ALTER TABLE public.user_watched_players
        ADD CONSTRAINT user_watched_players_player_id_fkey
        FOREIGN KEY (player_id) REFERENCES public.players(player_id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_watched_players_target_managed_player_id_fkey'
    ) THEN
        ALTER TABLE public.user_watched_players
        ADD CONSTRAINT user_watched_players_target_managed_player_id_fkey
        FOREIGN KEY (target_managed_player_id) REFERENCES public.players(player_id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS user_watched_players_unique_idx
ON public.user_watched_players (user_id, player_id, player_type, target_managed_player_id);

-- Security: Enable Row Level Security (RLS)
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_ranking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_watched_players ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Authenticated users can read players" ON public.players;
CREATE POLICY "Authenticated users can read players"
ON public.players
FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read history" ON public.player_ranking_history;
CREATE POLICY "Authenticated users can read history"
ON public.player_ranking_history
FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read category" ON public.category_rankings;
CREATE POLICY "Authenticated users can read category"
ON public.category_rankings
FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage players" ON public.players;
CREATE POLICY "Authenticated users can manage players"
ON public.players
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage history" ON public.player_ranking_history;
CREATE POLICY "Authenticated users can manage history"
ON public.player_ranking_history
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage category" ON public.category_rankings;
CREATE POLICY "Authenticated users can manage category"
ON public.category_rankings
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can fully manage their watched list" ON public.user_watched_players;
CREATE POLICY "Users can fully manage their watched list"
ON public.user_watched_players
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
