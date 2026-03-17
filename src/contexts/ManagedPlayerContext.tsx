import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../utils/supabaseClient';
import { type Player } from '../types/database';

interface ManagedPlayerContextType {
  managedPlayers: Player[];
  activeManagedPlayerId: string | null;
  activeManagedPlayer: Player | undefined;
  setActiveManagedPlayerId: (id: string | null) => void;
  fetchManagedPlayers: () => Promise<void>;
  deleteManagedPlayer: (id: string) => Promise<void>;
  isLoading: boolean;
}

const ManagedPlayerContext = createContext<ManagedPlayerContextType | undefined>(undefined);

export const ManagedPlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [managedPlayers, setManagedPlayers] = useState<Player[]>([]);
  const [activeManagedPlayerId, setActiveManagedPlayerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const activeManagedPlayer = managedPlayers.find(p => p.player_id === activeManagedPlayerId);

  const fetchManagedPlayers = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setManagedPlayers([]);
      setActiveManagedPlayerId(null);
      return;
    }

    setIsLoading(true);
    try {
      const { data: watchedRecords } = await supabase
        .from('user_watched_players')
        .select('player_id, created_at')
        .eq('user_id', session.user.id)
        .eq('player_type', 'managed')
        .order('created_at', { ascending: false });

      if (watchedRecords && watchedRecords.length > 0) {
        const pIds = watchedRecords.map(w => w.player_id);
        const { data: playersDetail } = await supabase
          .from('players')
          .select('*')
          .in('player_id', pIds);

        if (playersDetail) {
          const sortedPlayers = pIds
            .map(id => playersDetail.find(p => p.player_id === id))
            .filter(Boolean) as Player[];
          
          setManagedPlayers(sortedPlayers);

          if (!activeManagedPlayerId || !pIds.includes(activeManagedPlayerId)) {
            setActiveManagedPlayerId(sortedPlayers[0].player_id);
          }
        }
      } else {
        setManagedPlayers([]);
        setActiveManagedPlayerId(null);
      }
    } catch (error) {
      console.error('Error fetching managed players:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeManagedPlayerId]);

  const deleteManagedPlayer = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Delete opponents linked to this managed player
    await supabase
      .from('user_watched_players')
      .delete()
      .eq('user_id', session.user.id)
      .eq('target_managed_player_id', id);

    // Delete the managed player record itself
    await supabase
      .from('user_watched_players')
      .delete()
      .eq('user_id', session.user.id)
      .eq('player_id', id)
      .eq('player_type', 'managed');

    await fetchManagedPlayers();
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchManagedPlayers();
      } else {
        setManagedPlayers([]);
        setActiveManagedPlayerId(null);
      }
    });

    fetchManagedPlayers();

    const handleRefresh = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.playerType === 'managed') {
        fetchManagedPlayers();
      }
    };
    window.addEventListener('watched-players-changed', handleRefresh);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('watched-players-changed', handleRefresh);
    };
  }, [fetchManagedPlayers]);

  return (
    <ManagedPlayerContext.Provider value={{
      managedPlayers,
      activeManagedPlayerId,
      activeManagedPlayer,
      setActiveManagedPlayerId,
      fetchManagedPlayers,
      deleteManagedPlayer,
      isLoading
    }}>
      {children}
    </ManagedPlayerContext.Provider>
  );
};

export const useManagedPlayers = () => {
  const context = useContext(ManagedPlayerContext);
  if (context === undefined) {
    throw new Error('useManagedPlayers must be used within a ManagedPlayerProvider');
  }
  return context;
};
