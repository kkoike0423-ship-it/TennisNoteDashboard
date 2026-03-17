import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Trophy, MapPin, Plus, Trash2, Edit2, ChevronDown, ChevronUp, X, MessageSquare, Search, LayoutGrid, Info } from 'lucide-react';
import type { Tournament, Game, Player } from '../types/database';

interface GameWithOpponent extends Game {
  opponent_info?: Player | null; // backward compatibility
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
  userEmail?: string;
}

export const TournamentActivity: React.FC<TournamentActivityProps> = ({ activeManagedPlayerId, userEmail }) => {
  const [tournaments, setTournaments] = useState<TournamentWithGames[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTournament, setExpandedTournament] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState<number>(20);
  const [isAddingTournament, setIsAddingTournament] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [newTournament, setNewTournament] = useState<Partial<Tournament>>({
    name: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    category: '',
    match_type: 'Single'
  });

  const [editingGame, setEditingGame] = useState<{tournamentId: string, game: Partial<GameWithOpponent>} | null>(null);
  const [editingTournament, setEditingTournament] = useState<Partial<Tournament> | null>(null);
  const [opponentSearch, setOpponentSearch] = useState('');
  const [opponentSearch2, setOpponentSearch2] = useState('');
  const [activeSearchIndex, setActiveSearchIndex] = useState<1 | 2>(1);
  const [opponentSuggestions, setOpponentSuggestions] = useState<Player[]>([]);

  useEffect(() => {
    if (activeManagedPlayerId) {
      fetchData();
    }
  }, [activeManagedPlayerId]);

  useEffect(() => {
    if (expandedTournament) {
      setTimeout(() => {
        const element = document.getElementById(`tournament-row-${expandedTournament}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300); // Allow time for expansion animation
    }
  }, [expandedTournament]);

  useEffect(() => {
    if (editingTournament) {
      setTimeout(() => {
        const element = document.getElementById('tournament-edit-form');
        if (element) {
          const rect = element.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          window.scrollTo({ top: rect.top + scrollTop - 20, behavior: 'auto' });
          // Delay focus to ensure layout has settled
          setTimeout(() => {
            const input = element.querySelector('input');
            if (input) input.focus({ preventScroll: true });
          }, 800);
        }
      }, 100);
    }
  }, [editingTournament]);

  useEffect(() => {
    if (editingGame) {
      setTimeout(() => {
        const element = document.getElementById('game-edit-form');
        if (element) {
          const rect = element.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          window.scrollTo({ top: rect.top + scrollTop - 20, behavior: 'auto' });
          // Delay focus
          setTimeout(() => {
            const input = element.querySelector('input');
            if (input) input.focus({ preventScroll: true });
          }, 800);
        }
      }, 100);
    }
  }, [editingGame]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: tData, error: tError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('player_id', activeManagedPlayerId)
        .order('date', { ascending: false });

      if (tError) throw tError;

      const tIds = (tData || []).map(t => t.tournament_id);
      const { data: gData, error: gError } = await supabase
        .from('games')
        .select('*')
        .in('tournament_id', tIds)
        .order('created_at', { ascending: true });

      if (gError) throw gError;

      const opponent1Ids = (gData || []).map(g => g.opponent1_id).filter(Boolean);
      const opponent2Ids = (gData || []).map(g => g.opponent2_id).filter(Boolean);
      const opponentIds = Array.from(new Set([...opponent1Ids, ...opponent2Ids]));
      
      const { data: pData } = await supabase
        .from('players')
        .select('*')
        .in('player_id', opponentIds);

      const tournamentMonths = Array.from(new Set((tData || []).map(t => t.date ? t.date.substring(0, 7) : null).filter(Boolean)));
      
      const { data: rData } = await supabase
        .from('category_rankings')
        .select('player_id, year_month, rank, category')
        .in('player_id', opponentIds)
        .in('year_month', tournamentMonths);

      const combined = (tData || []).map(t => {
        const tMonth = t.date ? t.date.substring(0, 7) : null;
        return {
          ...t,
          games: (gData || []).filter(g => g.tournament_id === t.tournament_id).map(g => {
            const opponent1 = (pData || []).find(p => p.player_id === g.opponent1_id);
            const opponent2 = (pData || []).find(p => p.player_id === g.opponent2_id);
            
            const ranking1 = (rData || []).find(r => 
              r.player_id === g.opponent1_id && 
              r.year_month === tMonth && 
              r.category === opponent1?.category
            );
            const ranking2 = (rData || []).find(r => 
              r.player_id === g.opponent2_id && 
              r.year_month === tMonth && 
              r.category === opponent2?.category
            );
            
            return {
              ...g,
              opponent_info: opponent1, // keep for backward compatibility if needed
              opponent_rank: ranking1?.rank,
              opponent1_info: opponent1,
              opponent1_rank: ranking1?.rank,
              opponent2_info: opponent2,
              opponent2_rank: ranking2?.rank
            };
          })
        };
      });

      setTournaments(combined);
    } catch (err) {
      console.error('Error fetching tournament data:', err);
    } finally {
      setLoading(false);
    }
  };

  const groupedTournaments = useMemo(() => {
    const limited = tournaments.slice(0, displayCount);
    const groups: { [key: string]: TournamentWithGames[] } = {};
    limited.forEach(t => {
      const month = t.date ? t.date.substring(0, 7) : 'Unknown';
      if (!groups[month]) groups[month] = [];
      groups[month].push(t);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [tournaments, displayCount]);

  const handleAddTournament = async () => {
    if (!activeManagedPlayerId || !newTournament.name || isProcessing) return;

    // Check limits for non-admin users
    const isAdmin = userEmail === 'kkoike0423@gmail.com';
    if (!isAdmin) {
      const totalTournaments = tournaments.length;
      if (totalTournaments >= 50) {
        alert('登録制限：1選手あたりの大会登録数は最大50件までです。登録済みの大会を整理してください。');
        return;
      }
    }

    setIsProcessing(true);
    try {
        const tId = `T-${Date.now()}`;
        const payload = { ...newTournament, tournament_id: tId, player_id: activeManagedPlayerId };
        const { error } = await supabase.from('tournaments').insert([payload]);
        if (error) alert('Error: ' + error.message);
        else { setIsAddingTournament(false); fetchData(); }
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDeleteTournament = async (tId: string) => {
    if (isProcessing) return;
    if (!window.confirm('この大会を削除しますか？大会に含まれるすべての試合データも消去されます。よろしいですか？')) return;
    
    setIsProcessing(true);
    try {
        const { error } = await supabase.from('tournaments').delete().eq('tournament_id', tId);
        if (error) alert('Error: ' + error.message);
        else fetchData();
    } finally {
        setIsProcessing(false);
    }
  };

  const handleUpdateTournament = async () => {
    if (!editingTournament || !editingTournament.tournament_id || isProcessing) return;
    setIsProcessing(true);
    try {
        const { tournament_id, games, ...payload } = editingTournament as any;
        const { error } = await supabase.from('tournaments')
            .update(payload)
            .eq('tournament_id', tournament_id);
            
        if (error) alert('Error: ' + error.message);
        else { 
            setEditingTournament(null); 
            fetchData(); 
        }
    } finally {
        setIsProcessing(false);
    }
  };

  const handleEditGame = (tId: string, game: GameWithOpponent) => {
    setEditingGame({ tournamentId: tId, game: { ...game } });
    setOpponentSearch(game.opponent1_info?.full_name || game.opponent1_id || '');
    setOpponentSearch2(game.opponent2_info?.full_name || game.opponent2_id || '');
  };

  const handleAddGame = (tId: string) => {
    // Check limits for non-admin users
    const isAdmin = userEmail === 'kkoike0423@gmail.com';
    if (!isAdmin) {
      const totalGames = tournaments.reduce((acc, t) => acc + t.games.length, 0);
      if (totalGames >= 200) {
        alert('登録制限：1選手あたりの試合データ登録数は最大200件までです。データを整理してください。');
        return;
      }
    }

    setEditingGame({
      tournamentId: tId,
      game: {
        game_id: `G-${Date.now()}`,
        tournament_id: tId,
        main_player_id: activeManagedPlayerId || '',
        opponent1_id: '', opponent2_id: '', score: '', result: 'Win', memo: '',
        set1_self: 0, set1_opp: 0, set2_self: 0, set2_opp: 0,
        set3_self: 0, set3_opp: 0, set4_self: 0, set4_opp: 0,
        set5_self: 0, set5_opp: 0, tb_self: 0, tb_opp: 0,
        created_at: new Date().toISOString()
      }
    });
    setOpponentSearch('');
    setOpponentSearch2('');
  };

  const handleSaveGame = async () => {
    if (!editingGame || isProcessing) return;
    setIsProcessing(true);
    try {
        const { 
            opponent_info, opponent_rank, 
            opponent1_info, opponent1_rank, 
            opponent2_info, opponent2_rank, 
            ...gameToSave 
        } = editingGame.game;
        
        const scores = [];
        for(let i=1; i<=5; i++) {
            const self = (editingGame.game as any)[`set${i}_self`];
            const opp = (editingGame.game as any)[`set${i}_opp`];
            if (self !== 0 || opp !== 0) scores.push(`${self}-${opp}`);
        }
        if (editingGame.game.tb_self !== 0 || editingGame.game.tb_opp !== 0) scores.push(`[${editingGame.game.tb_self}-${editingGame.game.tb_opp}]`);
        gameToSave.score = scores.join(', ');
        
        const { error } = await supabase.from('games').upsert([gameToSave]);
        if (error) alert(error.message);
        else { setEditingGame(null); fetchData(); }
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDeleteGame = async (gId: string) => {
    if (isProcessing) return false;
    if (!window.confirm('この試合データを削除してもよいですか？')) return false;
    
    setIsProcessing(true);
    try {
        const { error } = await supabase.from('games').delete().eq('game_id', gId);
        if (error) {
            alert('Error: ' + error.message);
            return false;
        } else {
            fetchData();
            return true;
        }
    } finally {
        setIsProcessing(false);
    }
  };

  const searchOpponents = async (query: string, index: 1 | 2 = 1) => {
    setActiveSearchIndex(index);
    if (index === 1) {
      setOpponentSearch(query);
      if (editingGame) {
        setEditingGame({
          ...editingGame,
          game: { ...editingGame.game, opponent1_id: query }
        });
      }
    } else {
      setOpponentSearch2(query);
      if (editingGame) {
        setEditingGame({
          ...editingGame,
          game: { ...editingGame.game, opponent2_id: query }
        });
      }
    }

    if (query.length < 1) { setOpponentSuggestions([]); return; }
    const { data } = await supabase.from('players').select('*')
        .or(`full_name.ilike.%${query}%,last_name.ilike.%${query}%`).limit(8);
    setOpponentSuggestions(data || []);
  };

  if (!activeManagedPlayerId) return null;

  return (
    <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-8 border-b border-gray-50 bg-white flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 sm:w-14 sm:h-14 bg-tennis-green-100 rounded-xl sm:rounded-[1.25rem] flex items-center justify-center text-tennis-green-600 shadow-inner">
            <Trophy size={20} className="sm:w-7 sm:h-7" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">大会記録・戦績表</h3>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-100 p-1 rounded-xl">
             {[10, 30, 50].map(count => (
               <button 
                key={count} 
                onClick={() => setDisplayCount(count)}
                className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${displayCount === count ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
               >
                 {count}
               </button>
             ))}
          </div>
          <button
            onClick={() => setIsAddingTournament(true)}
            className="flex items-center gap-2 px-6 py-3.5 bg-emerald-600 text-white rounded-2xl text-sm font-black hover:bg-emerald-700 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isProcessing}
          >
            {isProcessing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Plus size={18} />}
            大会
          </button>
        </div>
      </div>

      <div className="p-2 sm:p-8">
        {isAddingTournament && (
          <div className="mb-8 p-5 sm:p-10 bg-gray-900 rounded-3xl text-white shadow-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-tennis-green-600/10 blur-[100px] rounded-full"></div>
            <div className="flex justify-between items-center mb-6 relative z-10">
              <h4 className="font-bold text-lg sm:text-2xl tracking-tighter">Enter Tournament Info / 新規大会の追加</h4>
              <button disabled={isProcessing} onClick={() => setIsAddingTournament(false)} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-all active:scale-90 disabled:opacity-30"><X size={20} /></button>
            </div>
            
            <div className="space-y-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-1 md:col-span-2">
                    <div className="flex items-center gap-3 mb-3">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-black shrink-0 transition-all ${newTournament.match_type === 'Double' ? 'bg-orange-500 text-white shadow-lg' : 'bg-blue-500 text-white shadow-lg'}`}>
                            {newTournament.match_type === 'Double' ? 'D' : 'S'}
                        </span>
                        <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest">大会名 / Tournament Name</label>
                    </div>
                    <input disabled={isProcessing} type="text" className="w-full px-5 py-4 bg-white/10 border-2 border-white/10 rounded-xl focus:border-tennis-green-400 outline-none text-base font-bold text-white transition-all disabled:opacity-50 placeholder:text-white/20" placeholder="例：東京都ジュニア選手権" value={newTournament.name} onChange={e => setNewTournament({...newTournament, name: e.target.value})} />
                </div>
                  <div>
                    <input disabled={isProcessing} type="date" className="w-full px-5 py-4 bg-white/10 border-2 border-white/10 rounded-xl focus:border-tennis-green-400 outline-none disabled:opacity-50 font-bold text-base text-white" value={newTournament.date} onChange={e => setNewTournament({...newTournament, date: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">会場 / Location</label>
                    <input disabled={isProcessing} type="text" className="w-full px-5 py-4 bg-white/10 border-2 border-white/10 rounded-xl focus:border-tennis-green-400 outline-none disabled:opacity-50 font-bold text-base text-white placeholder:text-white/20" placeholder="会場名を入力..." value={newTournament.location} onChange={e => setNewTournament({...newTournament, location: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">カテゴリー / Category</label>
                    <select 
                        disabled={isProcessing} 
                        className="w-full px-5 py-4 bg-white/10 border-2 border-white/10 rounded-xl focus:border-tennis-green-400 outline-none disabled:opacity-50 font-bold text-base text-white"
                        value={newTournament.category}
                        onChange={e => setNewTournament({...newTournament, category: e.target.value})}
                    >
                        <option value="" className="bg-gray-900 text-white">カテゴリーを選択...</option>
                        {['U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Open'].map(cat => (
                            <option key={cat} value={cat} className="bg-gray-900 text-white">{cat}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">種目 / Match Type</label>
                    <div className="flex gap-3">
                        {[
                            { label: 'シングルス', value: 'Single' },
                            { label: 'ダブルス', value: 'Double' }
                        ].map(type => (
                            <button
                                key={type.value}
                                disabled={isProcessing}
                                onClick={() => setNewTournament({...newTournament, match_type: type.value})}
                                className={`flex-1 py-4 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${newTournament.match_type === type.value ? 'bg-tennis-green-500 text-white shadow-xl scale-105 z-10' : 'bg-white/5 text-white/30 hover:bg-white/10 border border-white/10'}`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-4 mt-8">
                    <button disabled={isProcessing} onClick={handleAddTournament} className="flex-[2] py-4 bg-tennis-green-500 text-white rounded-xl text-xs font-black hover:bg-tennis-green-400 shadow-xl transition-all active:scale-95 flex justify-center items-center gap-2">
                        {isProcessing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                        大会情報を保存
                    </button>
                    <button disabled={isProcessing} onClick={() => setIsAddingTournament(false)} className="flex-1 py-4 bg-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/20 transition-all disabled:opacity-50">キャンセル</button>
                </div>
            </div>
          </div>
        )}

        {editingTournament && (
          <div id="tournament-edit-form" className="mb-8 p-5 sm:p-10 bg-gray-900 rounded-3xl text-white shadow-3xl relative overflow-hidden scroll-mt-24">
            <div className="absolute top-0 right-0 w-64 h-64 bg-tennis-green-600/10 blur-[100px] rounded-full"></div>
            <div className="flex justify-between items-center mb-6 relative z-10">
              <h4 className="font-bold text-lg sm:text-2xl tracking-tighter">大会情報の編集</h4>
              <button disabled={isProcessing} onClick={() => setEditingTournament(null)} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-all active:scale-90 disabled:opacity-30"><X size={20} /></button>
            </div>
            
            <div className="space-y-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-1 md:col-span-2">
                    <div className="flex items-center gap-3 mb-3">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-black shrink-0 transition-all ${editingTournament.match_type === 'Double' ? 'bg-orange-500 text-white shadow-lg' : 'bg-blue-500 text-white shadow-lg'}`}>
                            {editingTournament.match_type === 'Double' ? 'D' : 'S'}
                        </span>
                        <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest">大会名 / Tournament Name</label>
                    </div>
                    <input disabled={isProcessing} type="text" className="w-full px-5 py-4 bg-white/10 border-2 border-white/10 rounded-xl focus:border-tennis-green-400 outline-none text-base font-bold text-white transition-all disabled:opacity-50 placeholder:text-white/20" value={editingTournament.name || ''} onChange={e => setEditingTournament({...editingTournament, name: e.target.value})} />
                </div>
                  <div>
                    <input disabled={isProcessing} type="date" className="w-full px-5 py-4 bg-white/10 border-2 border-white/10 rounded-xl focus:border-tennis-green-400 outline-none disabled:opacity-50 font-bold text-base text-white" value={editingTournament.date || ''} onChange={e => setEditingTournament({...editingTournament, date: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">会場 / Location</label>
                    <input disabled={isProcessing} type="text" className="w-full px-5 py-4 bg-white/10 border-2 border-white/10 rounded-xl focus:border-tennis-green-400 outline-none disabled:opacity-50 font-bold text-base text-white placeholder:text-white/20" value={editingTournament.location || ''} onChange={e => setEditingTournament({...editingTournament, location: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">カテゴリー / Category</label>
                    <select 
                        disabled={isProcessing} 
                        className="w-full px-5 py-4 bg-white/10 border-2 border-white/10 rounded-xl focus:border-tennis-green-400 outline-none disabled:opacity-50 font-bold text-base text-white"
                        value={editingTournament.category || ''}
                        onChange={e => setEditingTournament({...editingTournament, category: e.target.value})}
                    >
                        <option value="" className="bg-gray-900 text-white">カテゴリーを選択...</option>
                        {['U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Open'].map(cat => (
                            <option key={cat} value={cat} className="bg-gray-900 text-white">{cat}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">種目 / Match Type</label>
                    <div className="flex gap-3">
                        {[
                            { label: 'シングルス', value: 'Single' },
                            { label: 'ダブルス', value: 'Double' }
                        ].map(type => (
                            <button
                                key={type.value}
                                disabled={isProcessing}
                                onClick={() => setEditingTournament({...editingTournament, match_type: type.value})}
                                className={`flex-1 py-4 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${editingTournament.match_type === type.value ? 'bg-tennis-green-500 text-white shadow-xl scale-105 z-10' : 'bg-white/5 text-white/30 hover:bg-white/10 border border-white/10'}`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-4 mt-8">
                    <button disabled={isProcessing} onClick={handleUpdateTournament} className="flex-[2] py-4 bg-tennis-green-500 text-white rounded-xl text-xs font-black hover:bg-tennis-green-400 shadow-xl transition-all active:scale-95 flex justify-center items-center gap-2">
                        {isProcessing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                        変更を保存
                    </button>
                    <button disabled={isProcessing} onClick={() => setEditingTournament(null)} className="flex-1 py-4 bg-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/20 transition-all disabled:opacity-50">キャンセル</button>
                </div>
            </div>
          </div>
        )}
        {editingGame && (
          <div id="game-edit-form" className="mb-8 p-5 sm:p-10 bg-gray-900 rounded-3xl text-white shadow-3xl relative overflow-hidden scroll-mt-24">
            {(() => {
                const parentTournament = tournaments.find(t => t.tournament_id === editingGame.tournamentId);
                const isDouble = (parentTournament?.match_type || parentTournament?.format || '').toLowerCase().includes('double');
                
                return (
                    <>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-tennis-green-600/10 blur-[100px] rounded-full"></div>
                        <div className="flex items-center justify-between mb-6 relative z-10">
                            <div className="flex flex-col gap-1">
                                <h6 className="font-bold text-lg sm:text-2xl tracking-tighter">試合結果の記録</h6>
                                <p className="text-[10px] font-bold text-white/30 truncate max-w-[200px] sm:max-w-none">{parentTournament?.name || '---'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {editingGame.game.game_id && !editingGame.game.game_id.startsWith('G-') && (
                                    <button 
                                        disabled={isProcessing} 
                                        onClick={async () => { 
                                            const success = await handleDeleteGame(editingGame.game.game_id!); 
                                            if (success) setEditingGame(null); 
                                        }} 
                                        className="w-10 h-10 flex items-center justify-center bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-all active:scale-90 shadow-lg disabled:opacity-30"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                                <button disabled={isProcessing} onClick={() => setEditingGame(null)} className="w-10 h-10 flex items-center justify-center bg-white/10 text-white rounded-full hover:bg-white/20 transition-all active:scale-90 disabled:opacity-30 shadow-lg"><X size={20} /></button>
                            </div>
                        </div>
                        
                        <div className="space-y-6 relative z-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="relative">
                                    <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3">Opponent 1 {isDouble ? '/ 対戦相手1' : '/ 対戦相手'}</label>
                                    <div className="relative">
                                        <input disabled={isProcessing} type="text" className="w-full px-5 py-4 bg-white/10 border-2 border-white/10 rounded-xl focus:border-tennis-green-400 outline-none pr-12 text-base font-bold text-white transition-all disabled:opacity-50" placeholder="氏名を入力..." value={opponentSearch} onChange={e => searchOpponents(e.target.value, 1)} />
                                        <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20" size={20} />
                                    </div>
                                    {opponentSuggestions.length > 0 && activeSearchIndex === 1 && !isProcessing && (
                                        <div className="absolute top-full left-0 w-full mt-2 bg-white text-gray-900 rounded-2xl shadow-3xl z-50 overflow-hidden max-h-60 overflow-y-auto border-2 border-gray-900">
                                            {opponentSuggestions.map(p => (
                                                <button key={p.player_id} className="w-full text-left px-5 py-3 hover:bg-tennis-green-50 transition-colors border-b border-gray-100 last:border-0" onClick={() => { setEditingGame({...editingGame!, game: {...editingGame!.game, opponent1_id: p.player_id}}); setOpponentSuggestions([]); setOpponentSearch(p.full_name); }}>
                                                    <div className="flex items-center justify-between font-bold text-sm">{p.full_name} <span className="text-[10px] text-tennis-green-600 bg-tennis-green-100 px-2 py-0.5 rounded-full">{p.ranking_point}pt</span></div>
                                                    <div className="text-[10px] text-gray-500 mt-0.5">{p.team} | {p.category}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {isDouble && (
                                    <div className="relative">
                                        <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3">Opponent 2 / 対戦相手2</label>
                                        <div className="relative">
                                            <input disabled={isProcessing} type="text" className="w-full px-5 py-4 bg-white/10 border-2 border-white/10 rounded-xl focus:border-tennis-green-400 outline-none pr-12 text-base font-bold text-white transition-all disabled:opacity-50" placeholder="氏名を入力..." value={opponentSearch2} onChange={e => searchOpponents(e.target.value, 2)} />
                                            <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20" size={20} />
                                        </div>
                                        {opponentSuggestions.length > 0 && activeSearchIndex === 2 && !isProcessing && (
                                            <div className="absolute top-full left-0 w-full mt-2 bg-white text-gray-900 rounded-2xl shadow-3xl z-50 overflow-hidden max-h-60 overflow-y-auto border-2 border-gray-900">
                                                {opponentSuggestions.map(p => (
                                                    <button key={p.player_id} className="w-full text-left px-5 py-3 hover:bg-tennis-green-50 transition-colors border-b border-gray-100 last:border-0" onClick={() => { setEditingGame({...editingGame!, game: {...editingGame!.game, opponent2_id: p.player_id}}); setOpponentSuggestions([]); setOpponentSearch2(p.full_name); }}>
                                                        <div className="flex items-center justify-between font-bold text-sm">{p.full_name} <span className="text-[10px] text-tennis-green-600 bg-tennis-green-100 px-2 py-0.5 rounded-full">{p.ranking_point}pt</span></div>
                                                        <div className="text-[10px] text-gray-500 mt-0.5">{p.team} | {p.category}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                {[1, 2, 3, 4, 5].map(setNum => (
                                    <div key={setNum} className="bg-white/5 p-3 rounded-xl border border-white/10">
                                        <p className="text-[9px] font-black text-center mb-2 text-white/20 uppercase tracking-widest">Set {setNum}</p>
                                        <div className="flex gap-1.5">
                                            <input disabled={isProcessing} type="number" className="w-full bg-white text-gray-900 text-center py-2 rounded-lg font-black text-base disabled:opacity-50" value={(editingGame.game[`set${setNum}_self` as keyof Game] as number) || 0} onChange={e => setEditingGame({...editingGame, game: {...editingGame.game, [`set${setNum}_self`]: parseInt(e.target.value) || 0}})} />
                                            <input disabled={isProcessing} type="number" className="w-full bg-white text-gray-900 text-center py-2 rounded-lg font-black text-base disabled:opacity-50" value={(editingGame.game[`set${setNum}_opp` as keyof Game] as number) || 0} onChange={e => setEditingGame({...editingGame, game: {...editingGame.game, [`set${setNum}_opp`]: parseInt(e.target.value) || 0}})} />
                                        </div>
                                    </div>
                                ))}
                                <div className="bg-tennis-green-500/20 p-3 rounded-xl border border-tennis-green-500/40">
                                    <p className="text-[9px] font-black text-center mb-2 text-tennis-green-400 uppercase tracking-widest">TieBreak</p>
                                    <div className="flex gap-1.5">
                                        <input disabled={isProcessing} type="number" className="w-full bg-white text-gray-900 text-center py-2 rounded-lg font-black text-base border border-tennis-green-500/20 disabled:opacity-50" value={editingGame.game.tb_self || 0} onChange={e => setEditingGame({...editingGame, game: {...editingGame.game, tb_self: parseInt(e.target.value) || 0}})} />
                                        <input disabled={isProcessing} type="number" className="w-full bg-white text-gray-900 text-center py-2 rounded-lg font-black text-base border border-tennis-green-500/20 disabled:opacity-50" value={editingGame.game.tb_opp || 0} onChange={e => setEditingGame({...editingGame, game: {...editingGame.game, tb_opp: parseInt(e.target.value) || 0}})} />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Outcome / 勝敗結果</label>
                                    <div className="flex gap-2">
                                        {['Win', 'Loss', 'Bye'].map(r => (
                                        <button disabled={isProcessing} key={r} onClick={() => setEditingGame({...editingGame, game: {...editingGame.game, result: r}})} className={`flex-1 py-4 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all disabled:opacity-50 ${editingGame.game.result === r ? 'bg-tennis-green-500 text-white shadow-xl scale-105 z-10' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}>
                                            {r === 'Loss' ? 'Loser' : r === 'Win' ? 'Winner' : 'Bye'}
                                        </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Custom Score / スコア修正</label>
                                    <input disabled={isProcessing} type="text" className="w-full px-5 py-4 bg-white/10 border-2 border-white/10 rounded-xl focus:border-tennis-green-400 outline-none text-base font-bold text-white disabled:opacity-50" value={editingGame.game.score || ''} onChange={e => setEditingGame({...editingGame, game: {...editingGame.game, score: e.target.value}})} />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Post-Match Memo / 分析・感想</label>
                                <textarea disabled={isProcessing} className="w-full px-5 py-4 bg-white/10 border-2 border-white/10 rounded-2xl focus:border-tennis-green-400 outline-none h-32 resize-none text-base font-medium leading-relaxed text-white disabled:opacity-50" placeholder="この試合の振り返りや、次の課題などを入力してください..." value={editingGame.game.memo || ''} onChange={e => setEditingGame({...editingGame, game: {...editingGame.game, memo: e.target.value}})}></textarea>
                            </div>
                            
                            <button disabled={isProcessing} onClick={handleSaveGame} className="w-full py-5 bg-tennis-green-500 text-white rounded-2xl text-base font-black hover:bg-tennis-green-400 shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3">
                                {isProcessing && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                                {editingGame.game.game_id && !editingGame.game.game_id.startsWith('G-') ? '試合結果を更新' : '試合結果を登録'}
                            </button>
                        </div>
                    </>
                );
            })()}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-tennis-green-100 border-t-tennis-green-600 rounded-full animate-spin"></div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Loading...</p>
          </div>
        ) : (
          <div className="space-y-12">
            {groupedTournaments.map(([month, monthTournaments]) => (
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
                                <th className="px-1 py-4 sm:px-6 text-left w-[18%]">日付</th>
                                <th className="px-1 py-4 sm:px-6 text-left">大会名 / 開催地</th>
                                <th className="px-1 py-4 sm:px-6 text-center w-[22%] last:rounded-r-2xl">試合数</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthTournaments.map(t => (
                                <React.Fragment key={t.tournament_id}>
                                    <tr 
                                        id={`tournament-row-${t.tournament_id}`}
                                        onClick={() => setExpandedTournament(expandedTournament === t.tournament_id ? null : t.tournament_id)}
                                        className={`group cursor-pointer transition-all scroll-mt-24 ${expandedTournament === t.tournament_id ? 'bg-gray-900 text-white shadow-2xl scale-[1.01] z-10 relative' : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-100 shadow-sm'}`}
                                    >
                                        <td className="px-1 py-3 sm:py-6 sm:px-6 first:rounded-l-2xl font-black text-sm">
                                            {(() => {
                                                const d = t.date || t.tournament_date || '';
                                                const parts = d.split(/[-/]/);
                                                return parts.length >= 3 ? `${parts[2]}日` : '--';
                                            })()}
                                        </td>
                                        <td className="px-1 py-3 sm:py-6 sm:px-6 text-sm font-black tracking-tight leading-snug">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    {(() => {
                                                        const typeRaw = (t.match_type || t.format || 'Single').toLowerCase();
                                                        const isDouble = typeRaw.includes('double');
                                                        return (
                                                            <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-black shrink-0 ${isDouble ? 'bg-orange-500 text-white shadow-sm' : 'bg-blue-500 text-white shadow-sm'}`}>
                                                                {isDouble ? 'D' : 'S'}
                                                            </span>
                                                        );
                                                    })()}
                                                    <span className="break-words">{t.name || t.tournament_name || '名称未設定'}</span>
                                                </div>
                                                <div className={`flex items-center gap-1.5 text-[0.75rem] font-bold ${expandedTournament === t.tournament_id ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    <MapPin size={12} className="shrink-0" />
                                                    <span className="truncate">{t.location || '---'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-1 py-3 sm:py-6 sm:px-6 text-center last:rounded-r-2xl">
                                            <div className="flex items-center justify-center gap-4">
                                                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black ${expandedTournament === t.tournament_id ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                    {t.games.length}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {expandedTournament === t.tournament_id ? <ChevronUp size={16} /> : <ChevronDown size={16} className={expandedTournament === t.tournament_id ? 'text-white/30' : 'text-gray-300'} />}
                                                    <button 
                                                        disabled={isProcessing}
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            const rawDate = t.date || t.tournament_date || '';
                                                            const normalizedDate = rawDate.includes('T') 
                                                                ? rawDate.split('T')[0] 
                                                                : rawDate.replace(/\//g, '-');

                                                            const normalized = {
                                                                ...t,
                                                                name: t.name || t.tournament_name || '',
                                                                date: normalizedDate,
                                                                match_type: (t.match_type || t.format || 'Single').toLowerCase().includes('double') ? 'Double' : 'Single'
                                                            };
                                                            setEditingTournament(normalized); 
                                                        }} 
                                                        className={`p-2 rounded-xl transition-all ${expandedTournament === t.tournament_id ? 'bg-tennis-green-500 text-white shadow-lg' : 'opacity-0 group-hover:opacity-100 text-tennis-green-600 bg-tennis-green-50 hover:bg-tennis-green-100'}`}
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button 
                                                        disabled={isProcessing}
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteTournament(t.tournament_id); }} 
                                                        className={`p-2 rounded-xl transition-all ${expandedTournament === t.tournament_id ? 'bg-rose-500 text-white shadow-lg' : 'opacity-0 group-hover:opacity-100 text-rose-500 bg-rose-50 hover:bg-rose-100'}`}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    
                                    {expandedTournament === t.tournament_id && (
                                        <tr>
                                            <td colSpan={3} className="p-0">
                                                <div className="bg-gray-50 border-x-4 border-b-4 border-gray-900 rounded-b-[2rem] p-4 sm:p-6 animate-in slide-in-from-top-2 duration-300 shadow-2xl mb-8">
                                                    <div id={`match-list-${t.tournament_id}`} className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200 scroll-mt-20">
                                                        <h5 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em] flex items-center gap-2">
                                                            <LayoutGrid size={16} className="text-tennis-green-600" /> 試合記録
                                                        </h5>
                                                        <button 
                                                            disabled={isProcessing}
                                                            onClick={() => handleAddGame(t.tournament_id)} 
                                                            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-50"
                                                        >
                                                            <Plus size={16} /> 試合
                                                        </button>
                                                    </div>

                                                    <div className="flex flex-col gap-4">
                                                        {t.games.map((g, idx) => (
                                                            <div key={g.game_id} className="p-3 sm:p-5 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group/item relative">
                                                                <div className="absolute top-4 left-0 w-1 h-8 bg-tennis-green-500 rounded-r-full group-hover/item:h-12 transition-all duration-300"></div>
                                                                
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div className="flex items-start gap-2 sm:gap-4 flex-1 min-w-0">
                                                                        {/* Compact Match Number */}
                                                                        <div className="flex flex-col items-center justify-center w-6 sm:w-10 shrink-0 pt-1">
                                                                            <div className="text-[8px] font-black text-gray-300 uppercase tracking-tighter">M</div>
                                                                            <div className="text-sm sm:text-base font-black text-gray-900 font-mono tracking-tighter leading-none">{idx + 1}</div>
                                                                        </div>
                                                                        
                                                                        <div className="flex-1 min-w-0">
                                                                            {/* Result & Name Line */}
                                                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                                                <div className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${g.result === 'Win' ? 'bg-emerald-600 text-white' : 'bg-rose-500 text-white'}`}>
                                                                                    {g.result === 'Win' ? 'Win' : 'Loss'}
                                                                                </div>
                                                                                <div className="text-sm sm:text-base font-black text-gray-900 tracking-tight truncate flex items-center gap-1">
                                                                                    <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-400 font-bold shrink-0">
                                                                                        {g.opponent1_info?.category || g.opponent_info?.category || '---'}
                                                                                    </span>
                                                                                    <span className="truncate">
                                                                                        {g.opponent1_info?.full_name || g.opponent1_id || '---'}
                                                                                        {g.opponent1_rank && <span className="text-[11px] text-tennis-green-600 font-black ml-1">({g.opponent1_rank}位)</span>}
                                                                                        {g.opponent2_id && (
                                                                                            <>
                                                                                                <span className="mx-2 font-bold text-gray-300">/</span>
                                                                                                {g.opponent2_info?.full_name || g.opponent2_id}
                                                                                                {g.opponent2_rank && <span className="text-[11px] text-tennis-green-600 font-black ml-1">({g.opponent2_rank}位)</span>}
                                                                                            </>
                                                                                        )}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            
                                                                            {/* Team Info Row */}
                                                                            <div className="flex items-center gap-3 mb-3">
                                                                                <div className="flex items-center gap-1 min-w-0">
                                                                                    <span className="text-[11px] font-bold text-gray-400 truncate">{g.opponent1_info?.team || g.opponent_info?.team || '---'}</span>
                                                                                    {g.opponent2_info?.team && (
                                                                                        <>
                                                                                            <span className="text-gray-200 mx-1">/</span>
                                                                                            <span className="text-[11px] font-bold text-gray-400 truncate">{g.opponent2_info.team}</span>
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            {/* Score Row - More compact */}
                                                                            <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 inline-flex">
                                                                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] border-r border-gray-200 pr-2">Score</span>
                                                                                <div className="font-mono text-sm sm:text-base font-black text-gray-900 tracking-widest">
                                                                                    {g.score || '--'}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {/* Buttons - More compact */}
                                                                    <div className="flex flex-col gap-2 shrink-0">
                                                                        <button disabled={isProcessing} onClick={() => handleEditGame(t.tournament_id, g)} className="p-2 text-tennis-green-600 bg-tennis-green-50 hover:bg-tennis-green-100 rounded-xl transition-all disabled:opacity-30">
                                                                            <Edit2 size={16} />
                                                                        </button>
                                                                        <button disabled={isProcessing} onClick={() => handleDeleteGame(g.game_id)} className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all disabled:opacity-30">
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {g.memo && (
                                                                    <div className="mt-3 p-3 bg-tennis-green-50 rounded-xl text-[11px] text-gray-600 border border-tennis-green-100 flex gap-2 relative">
                                                                        <MessageSquare size={14} className="text-tennis-green-500 shrink-0 mt-0.5" />
                                                                        <p className="leading-relaxed font-medium whitespace-pre-wrap flex-1">{g.memo}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                        
                                                        {t.games.length === 0 && (
                                                            <div className="py-20 text-center flex flex-col items-center gap-4 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                                                                <div className="p-4 bg-gray-50 rounded-full text-gray-300"><Info size={32} /></div>
                                                                <p className="text-gray-400 font-bold">まだこの大会の試合結果は記録されていません。</p>
                                                            </div>
                                                        )}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
