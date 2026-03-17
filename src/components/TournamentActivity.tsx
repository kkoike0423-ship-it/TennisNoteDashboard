import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Plus, LayoutGrid, ChevronDown, ChevronUp, Edit2, Trash2 } from 'lucide-react';
import { type Tournament, type Game, type Player } from '../types/database';
import { MatchForm } from './tournament/MatchForm';
import { TournamentForm } from './tournament/TournamentForm';

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
              opponent_info: op1, opponent_rank: r1?.rank // backward compatibility
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
        <div className="space-y-12">
          {groupedTournaments.length === 0 ? (
            <div className="py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No Data Found</p>
            </div>
          ) : (
            groupedTournaments.map(([month, monthTournaments]) => (
              <div key={month} className="animate-in fade-in duration-500">
                <div className="flex items-center gap-4 mb-6">
                  <div className="px-5 py-2.5 bg-gray-900 text-white rounded-2xl text-xs font-black tracking-widest shadow-xl font-mono">
                    {month.replace('-', ' / ')}
                  </div>
                  <div className="h-[2px] flex-1 bg-gradient-to-r from-gray-100 to-transparent"></div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <th className="px-6 py-4 text-left w-[18%]">日付</th>
                        <th className="px-6 py-4 text-left">大会名 / 開催地</th>
                        <th className="px-6 py-4 text-center w-[22%]">試合数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthTournaments.map(t => (
                        <React.Fragment key={t.tournament_id}>
                          <tr 
                            onClick={() => setExpandedTournament(expandedTournament === t.tournament_id ? null : t.tournament_id)}
                            className={`group cursor-pointer transition-all ${expandedTournament === t.tournament_id ? 'bg-gray-900 text-white shadow-2xl scale-[1.01] z-10 relative' : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-100 shadow-sm'}`}
                          >
                            <td className="px-6 py-4 first:rounded-l-2xl font-black text-sm">
                              {t.date?.split('-')[2] || '--'}日
                            </td>
                            <td className="px-6 py-4 text-sm font-black tracking-tight flex items-center gap-3">
                              <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-black shrink-0 ${t.match_type?.toLowerCase().includes('double') ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'}`}>
                                {t.match_type?.toLowerCase().includes('double') ? 'D' : 'S'}
                              </span>
                              <div className="flex flex-col">
                                <span>{t.name || '名称未設定'}</span>
                                <span className={`text-[10px] font-bold ${expandedTournament === t.tournament_id ? 'text-white/40' : 'text-gray-400'}`}>{t.location || '---'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center last:rounded-r-2xl">
                              <div className="flex items-center justify-center gap-4">
                                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black ${expandedTournament === t.tournament_id ? 'bg-white/10' : 'bg-gray-100 text-gray-500'}`}>{t.games.length}</span>
                                {expandedTournament === t.tournament_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </td>
                          </tr>
                          {expandedTournament === t.tournament_id && (
                            <tr>
                              <td colSpan={3} className="p-0">
                                <div className="bg-gray-50 border-x-4 border-b-4 border-gray-900 rounded-b-[2rem] p-6 animate-in slide-in-from-top-2 duration-300 shadow-2xl mb-8">
                                  <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-200">
                                    <h5 className="text-[10px] font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                      試合記録
                                    </h5>
                                    <div className="flex gap-2">
                                      <button onClick={() => setEditingTournament(t)} className="p-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100"><Edit2 size={16} /></button>
                                      <button onClick={() => handleDeleteTournament(t.tournament_id)} className="p-2 bg-white border border-gray-200 text-rose-500 rounded-xl hover:bg-rose-50"><Trash2 size={16} /></button>
                                      <button onClick={() => setEditingGame({ tournamentId: t.tournament_id, game: { tournament_id: t.tournament_id, main_player_id: activeManagedPlayerId! } })} className="px-4 py-2 bg-tennis-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                        <Plus size={14} /> 追加
                                      </button>
                                    </div>
                                  </div>
                                  <div className="space-y-4">
                                    {t.games.map((g, idx) => (
                                      <div key={g.game_id} className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${g.result === 'Win' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{idx+1}</div>
                                          <div>
                                            <div className="text-sm font-black text-gray-900">{g.opponent1_info?.full_name || '---'} {g.opponent2_info ? `/ ${g.opponent2_info.full_name}` : ''}</div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{g.score || '--'}</div>
                                          </div>
                                        </div>
                                        <div className="flex gap-2">
                                          <button onClick={() => setEditingGame({ tournamentId: t.tournament_id, game: g })} className="p-2 text-gray-400 hover:text-tennis-green-600 transition-colors"><Edit2 size={16} /></button>
                                          <button onClick={() => handleDeleteGame(g.game_id)} className="p-2 text-gray-400 hover:text-rose-600 transition-colors"><Trash2 size={16} /></button>
                                        </div>
                                      </div>
                                    ))}
                                    {t.games.length === 0 && <p className="text-center py-10 text-gray-400 text-xs font-bold uppercase tracking-widest">No Matches Recorded</p>}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
