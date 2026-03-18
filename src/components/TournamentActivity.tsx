import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Plus, LayoutGrid } from 'lucide-react';
import { type Tournament, type Game, type Player } from '../types/database';
import { MatchForm } from './tournament/MatchForm';
import { TournamentForm } from './tournament/TournamentForm';
import { TournamentList } from './tournament/TournamentList';

interface GameWithOpponent extends Game {
  opponent_info?: Player | null;
  opponent_rank?: number | null;
  opponent1_info?: Player | null;
  opponent1_rank?: number | null;
  opponent2_info?: Player | null;
  opponent2_rank?: number | null;
}

interface TournamentWithGames extends Tournament {
  games: GameWithOpponent[];
}

interface TournamentActivityProps {
  activeManagedPlayerId: string | null;
}

export const TournamentActivity: React.FC<TournamentActivityProps> = ({ activeManagedPlayerId }) => {
  const [tournaments, setTournaments] = useState<TournamentWithGames[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTournament, setExpandedTournament] = useState<string | null>(null);
  const [isAddingTournament, setIsAddingTournament] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [editingGame, setEditingGame] = useState<{tournamentId: string, game: Partial<GameWithOpponent>} | null>(null);
  const [editingTournament, setEditingTournament] = useState<Partial<Tournament> | null>(null);

  useEffect(() => {
    if (activeManagedPlayerId) fetchData();
  }, [activeManagedPlayerId]);

  useEffect(() => {
    if (isAddingTournament || editingTournament) {
      document.getElementById('tournament-edit-form')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isAddingTournament, editingTournament]);

  useEffect(() => {
    if (editingGame) {
      document.getElementById('game-edit-form')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [editingGame]);

  const fetchData = async () => {
    if (!activeManagedPlayerId) return;
    setLoading(true);
    try {
      const { data: tData } = await supabase.from('tournaments').select('*').eq('player_id', activeManagedPlayerId).order('date', { ascending: false });
      const tIds = (tData || []).map(t => t.tournament_id);
      const { data: gData } = await supabase.from('games').select('*').in('tournament_id', tIds).order('created_at', { ascending: true });

      const opponentIds = Array.from(new Set([...(gData || []).map(g => g.opponent1_id), ...(gData || []).map(g => g.opponent2_id)].filter(Boolean)));
      const { data: pData } = await supabase.from('players').select('*').in('player_id', opponentIds);
      
      const tournamentMonths = Array.from(new Set((tData || []).map(t => t.date ? t.date.substring(0, 7) : null).filter(Boolean)));
      const { data: rData } = await supabase.from('category_rankings').select('player_id, year_month, rank, category').in('player_id', opponentIds).in('year_month', tournamentMonths);

      const combined = (tData || []).map(t => {
        const tMonth = t.date ? t.date.substring(0, 7) : null;
        return {
          ...t,
          games: (gData || []).filter(g => g.tournament_id === t.tournament_id).map(g => {
            const op1 = (pData || []).find(p => p.player_id === g.opponent1_id);
            const op2 = (pData || []).find(p => p.player_id === g.opponent2_id);
            const r1 = (rData || []).find(r => r.player_id === g.opponent1_id && r.year_month === tMonth && r.category === op1?.category);
            const r2 = (rData || []).find(r => r.player_id === g.opponent2_id && r.year_month === tMonth && r.category === op2?.category);
            return {
              ...g,
              opponent1_info: op1, opponent1_rank: r1?.rank,
              opponent2_info: op2, opponent2_rank: r2?.rank,
              opponent_info: op1, opponent_rank: r1?.rank 
            };
          })
        };
      });
      setTournaments(combined);
    } finally {
      setLoading(false);
    }
  };

  const groupedTournaments = useMemo(() => {
    const groups: { [key: string]: TournamentWithGames[] } = {};
    tournaments.forEach(t => {
      const month = t.date ? t.date.substring(0, 7) : 'Unknown';
      if (!groups[month]) groups[month] = [];
      groups[month].push(t);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [tournaments]);

  const handleSaveTournament = async (data: Partial<Tournament>) => {
    if (!activeManagedPlayerId || isProcessing) return;
    setIsProcessing(true);
    try {
      const tId = data.tournament_id || `T-${Date.now()}`;
      const title = data.name || (data as any).tournament_name || '';
      const { games, ...payload } = data as any;

      const { error } = await supabase.from('tournaments').upsert([{
        ...payload,
        tournament_id: tId,
        player_id: activeManagedPlayerId,
        name: title
      }]);

      if (error) alert(error.message);
      else {
        setIsAddingTournament(false);
        setEditingTournament(null);
        fetchData();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTournament = async (tId: string) => {
    if (!window.confirm('この大会を削除しますか？試合データも消去されます。')) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('tournaments').delete().eq('tournament_id', tId);
      if (!error) fetchData();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveGame = async (game: Partial<GameWithOpponent>) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const { opponent1_info, opponent2_info, opponent_info, opponent_rank, opponent1_rank, opponent2_rank, ...payload } = game as any;
      const { error } = await supabase.from('games').upsert([payload]);
      if (error) alert(error.message);
      else {
        setEditingGame(null);
        fetchData();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteGame = async (gId: string) => {
    if (!window.confirm('この試合を削除しますか？')) return false;
    const { error } = await supabase.from('games').delete().eq('game_id', gId);
    if (!error) {
      fetchData();
      return true;
    }
    return false;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
          <LayoutGrid size={18} className="text-tennis-green-600" /> Tournament Activity
        </h3>
        <button 
          onClick={() => setIsAddingTournament(true)}
          className="px-6 py-3 bg-gray-900 text-white rounded-2xl text-xs font-black hover:bg-tennis-green-600 transition-all flex items-center gap-2 shadow-xl active:scale-95"
        >
          <Plus size={18} /> 大会を追加
        </button>
      </div>

      {isAddingTournament && (
        <TournamentForm 
          title="新しい大会の登録"
          initialData={{ date: new Date().toISOString().split('T')[0], match_type: 'Single' }}
          isProcessing={isProcessing}
          onSave={handleSaveTournament}
          onCancel={() => setIsAddingTournament(false)}
        />
      )}

      {editingTournament && (
        <TournamentForm 
          title="大会情報の編集"
          initialData={editingTournament}
          isProcessing={isProcessing}
          onSave={handleSaveTournament}
          onCancel={() => setEditingTournament(null)}
        />
      )}

      {editingGame && (
        <MatchForm 
          tournament={tournaments.find(t => t.tournament_id === editingGame.tournamentId)!}
          editingGame={editingGame}
          isProcessing={isProcessing}
          onSave={handleSaveGame}
          onDelete={handleDeleteGame}
          onCancel={() => setEditingGame(null)}
        />
      )}

      {loading ? (
        <div className="py-20 text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-tennis-green-100 border-t-tennis-green-600 rounded-full animate-spin"></div>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Loading...</p>
        </div>
      ) : (
        <TournamentList 
          groupedTournaments={groupedTournaments}
          expandedTournament={expandedTournament}
          onToggleExpand={(id) => setExpandedTournament(expandedTournament === id ? null : id)}
          onEditTournament={(t) => setEditingTournament(t)}
          onDeleteTournament={handleDeleteTournament}
          onAddMatch={(tId) => setEditingGame({ tournamentId: tId, game: { tournament_id: tId, main_player_id: activeManagedPlayerId! } })}
          onEditMatch={(tId, game) => setEditingGame({ tournamentId: tId, game })}
          onDeleteMatch={handleDeleteGame}
        />
      )}
    </div>
  );
};
