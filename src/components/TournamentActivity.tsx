import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Trophy, MapPin, Plus, Trash2, Edit2, ChevronDown, ChevronUp, X, MessageSquare, User, Hash, Search, LayoutGrid, Info } from 'lucide-react';
import type { Tournament, Game, Player } from '../types/database';

interface GameWithOpponent extends Game {
  opponent_info?: Player | null;
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
  const [opponentSearch, setOpponentSearch] = useState('');
  const [opponentSuggestions, setOpponentSuggestions] = useState<Player[]>([]);

  useEffect(() => {
    if (activeManagedPlayerId) {
      fetchData();
    }
  }, [activeManagedPlayerId]);

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

      const opponentIds = Array.from(new Set((gData || []).map(g => g.opponent1_id).filter(Boolean)));
      const { data: pData } = await supabase
        .from('players')
        .select('*')
        .in('player_id', opponentIds);

      const combined = (tData || []).map(t => ({
        ...t,
        games: (gData || []).filter(g => g.tournament_id === t.tournament_id).map(g => ({
          ...g,
          opponent_info: (pData || []).find(p => p.player_id === g.opponent1_id)
        }))
      }));

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

  const handleEditGame = (tId: string, game: GameWithOpponent) => {
    setEditingGame({ tournamentId: tId, game: { ...game } });
    setOpponentSearch(game.opponent_info?.full_name || game.opponent1_id || '');
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
        opponent1_id: '', score: '', result: 'Win', memo: '',
        set1_self: 0, set1_opp: 0, set2_self: 0, set2_opp: 0,
        set3_self: 0, set3_opp: 0, set4_self: 0, set4_opp: 0,
        set5_self: 0, set5_opp: 0, tb_self: 0, tb_opp: 0,
        created_at: new Date().toISOString()
      }
    });
    setOpponentSearch('');
  };

  const handleSaveGame = async () => {
    if (!editingGame || isProcessing) return;
    setIsProcessing(true);
    try {
        const { opponent_info, ...gameToSave } = editingGame.game;
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
    if (isProcessing) return;
    if (!window.confirm('この試合データを削除してもよいですか？')) return;
    
    setIsProcessing(true);
    try {
        const { error } = await supabase.from('games').delete().eq('game_id', gId);
        if (error) alert('Error: ' + error.message);
        else fetchData();
    } finally {
        setIsProcessing(false);
    }
  };

  const searchOpponents = async (query: string) => {
    setOpponentSearch(query);
    if (query.length < 1) { setOpponentSuggestions([]); return; }
    const { data } = await supabase.from('players').select('*')
        .or(`full_name.ilike.%${query}%,last_name.ilike.%${query}%`).limit(8);
    setOpponentSuggestions(data || []);
  };

  if (!activeManagedPlayerId) return null;

  return (
    <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-8 border-b border-gray-50 bg-white flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-tennis-green-100 rounded-[1.25rem] flex items-center justify-center text-tennis-green-600 shadow-inner">
            <Trophy size={28} />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight">大会記録・戦績表</h3>
            <p className="text-sm text-gray-500 font-medium">Tournament History & Match Analysis</p>
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

      <div className="p-8">
        {isAddingTournament && (
          <div className="mb-10 p-8 bg-tennis-green-50 rounded-[2rem] border-2 border-tennis-green-100 animate-in slide-in-from-top-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-black text-tennis-green-800 text-lg">新規大会の追加</h4>
              <button disabled={isProcessing} onClick={() => setIsAddingTournament(false)} className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-tennis-green-400 shadow-sm hover:text-rose-500 transition-colors"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-1 md:col-span-2">
                    <label className="block text-[10px] font-black text-tennis-green-600 uppercase tracking-widest mb-2">大会名</label>
                    <input disabled={isProcessing} type="text" className="w-full px-5 py-3 rounded-2xl border-2 border-tennis-green-100 outline-none transition-all disabled:opacity-50 bg-gray-50" placeholder="例：東京都ジュニア選手権" value={newTournament.name} onChange={e => setNewTournament({...newTournament, name: e.target.value})} />
                </div>
              <div>
                <label className="block text-[10px] font-black text-tennis-green-600 uppercase tracking-widest mb-2">開催日</label>
                <input disabled={isProcessing} type="date" className="w-full px-5 py-3 rounded-2xl border-2 border-tennis-green-100 outline-none disabled:opacity-50 bg-gray-50" value={newTournament.date} onChange={e => setNewTournament({...newTournament, date: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-tennis-green-600 uppercase tracking-widest mb-2">会場 / 場所</label>
                <input disabled={isProcessing} type="text" className="w-full px-5 py-3 rounded-2xl border-2 border-tennis-green-100 outline-none disabled:opacity-50 bg-gray-50" value={newTournament.location} onChange={e => setNewTournament({...newTournament, location: e.target.value})} />
              </div>
            </div>
            <button disabled={isProcessing} onClick={handleAddTournament} className="mt-8 w-full py-4 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 shadow-xl disabled:opacity-50 flex justify-center items-center gap-2">
                {isProcessing && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                保存する
            </button>
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
                                <th className="px-6 py-4 text-left w-24">日付</th>
                                <th className="px-6 py-4 text-left">大会名 / 開催地</th>
                                <th className="px-6 py-4 text-center w-24 last:rounded-r-2xl">試合数</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthTournaments.map(t => (
                                <React.Fragment key={t.tournament_id}>
                                    <tr 
                                        onClick={() => setExpandedTournament(expandedTournament === t.tournament_id ? null : t.tournament_id)}
                                        className={`group cursor-pointer transition-all ${expandedTournament === t.tournament_id ? 'bg-gray-900 text-white shadow-2xl scale-[1.01] z-10 relative' : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-100 shadow-sm'}`}
                                    >
                                        <td className="px-6 py-6 first:rounded-l-2xl font-black text-sm">
                                            {(() => {
                                                const d = t.date || t.tournament_date || '';
                                                const parts = d.split(/[-/]/);
                                                return parts.length >= 3 ? `${parts[2]}日` : '--';
                                            })()}
                                        </td>
                                        <td className="px-6 py-6 text-sm font-black tracking-tight leading-snug">
                                            <div className="flex flex-col gap-1.5">
                                                <span className="break-words">{t.name}</span>
                                                <div className={`flex items-center gap-1.5 text-[0.75rem] font-bold ${expandedTournament === t.tournament_id ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    <MapPin size={12} className="shrink-0" />
                                                    <span className="truncate">{t.location || '---'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-center last:rounded-r-2xl">
                                            <div className="flex items-center justify-center gap-4">
                                                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black ${expandedTournament === t.tournament_id ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                    {t.games.length}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {expandedTournament === t.tournament_id ? <ChevronUp size={16} /> : <ChevronDown size={16} className={expandedTournament === t.tournament_id ? 'text-white/30' : 'text-gray-300'} />}
                                                    <button 
                                                        disabled={isProcessing}
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteTournament(t.tournament_id); }} 
                                                        className={`p-1.5 rounded-lg transition-all ${expandedTournament === t.tournament_id ? 'text-rose-400 hover:bg-white/10' : 'opacity-0 group-hover:opacity-100 text-rose-500 hover:bg-rose-50'}`}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    
                                    {expandedTournament === t.tournament_id && (
                                        <tr>
                                            <td colSpan={3} className="p-0">
                                                <div className="bg-gray-50 border-x-4 border-b-4 border-gray-900 rounded-b-[2rem] p-8 animate-in slide-in-from-top-2 duration-300 shadow-2xl mb-8">
                                                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
                                                        <h5 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em] flex items-center gap-2">
                                                            <LayoutGrid size={16} className="text-tennis-green-600" /> Match History / 試合記録
                                                        </h5>
                                                        <button 
                                                            disabled={isProcessing}
                                                            onClick={() => handleAddGame(t.tournament_id)} 
                                                            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-50"
                                                        >
                                                            <Plus size={16} /> 試合を追加
                                                        </button>
                                                    </div>

                                                    <div className="flex flex-col gap-6">
                                                        {t.games.map((g, idx) => (
                                                            <div key={g.game_id} className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group/item relative">
                                                                <div className="absolute top-6 left-0 w-1.5 h-10 bg-tennis-green-500 rounded-r-full group-hover/item:h-16 transition-all duration-300"></div>
                                                                
                                                                <div className="flex items-start justify-between">
                                                                    <div className="flex items-start gap-6 flex-1">
                                                                        <div className="flex flex-col items-center gap-2">
                                                                            <div className="text-xs font-black text-gray-300 uppercase tracking-tighter">Match</div>
                                                                            <div className="text-lg font-black text-gray-900 font-mono tracking-tighter leading-none">{idx + 1}</div>
                                                                        </div>
                                                                        
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex flex-wrap items-center gap-3 mb-3">
                                                                                <div className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm ${g.result === 'Win' ? 'bg-emerald-600 text-white' : 'bg-rose-500 text-white'}`}>
                                                                                    {g.result === 'Win' ? 'Winner' : 'Loser'}
                                                                                </div>
                                                                                <p className="text-base font-black text-gray-900 tracking-tight">vs {g.opponent_info?.full_name || g.opponent1_id || '---'}</p>
                                                                                {g.opponent_info && (
                                                                                    <span className="px-2 py-0.5 bg-tennis-green-50 text-tennis-green-700 rounded-lg text-xs font-black border border-tennis-green-100">Registered</span>
                                                                                )}
                                                                            </div>
                                                                            
                                                                            <div className="flex flex-wrap items-center gap-6 mb-4">
                                                                                <div className="flex items-center gap-2">
                                                                                    <User size={14} className="text-gray-300" />
                                                                                    <span className="text-xs font-bold text-gray-500">{g.opponent_info?.team || 'Free / No Team'}</span>
                                                                                </div>
                                                                                <div className="flex items-center gap-2 text-tennis-green-600">
                                                                                    <Trophy size={14} />
                                                                                    <span className="text-xs font-black uppercase tracking-widest">{g.opponent_info?.category || '---'}</span>
                                                                                </div>
                                                                                <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-lg border border-gray-100">
                                                                                    <Hash size={14} className="text-gray-400" />
                                                                                    <span className="text-xs font-black text-gray-900">{g.opponent_info?.ranking_point.toLocaleString() || '0'} Points</span>
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-inner">
                                                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] [writing-mode:vertical-lr] border-r border-gray-200 pr-2 mr-2">Score</span>
                                                                                <div className="font-mono text-xl font-black text-gray-900 tracking-widest">
                                                                                    {g.score || '--'}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <div className="flex flex-col gap-2">
                                                                        <button disabled={isProcessing} onClick={() => handleEditGame(t.tournament_id, g)} className="p-3 text-gray-300 hover:text-tennis-green-600 hover:bg-gray-50 rounded-2xl transition-all shadow-sm disabled:opacity-30">
                                                                            <Edit2 size={18} />
                                                                        </button>
                                                                        <button disabled={isProcessing} onClick={() => handleDeleteGame(g.game_id)} className="p-3 text-gray-300 hover:text-rose-500 hover:bg-gray-50 rounded-2xl transition-all shadow-sm disabled:opacity-30 opacity-0 group-hover/item:opacity-100">
                                                                            <Trash2 size={18} />
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {g.memo && (
                                                                    <div className="mt-6 p-5 bg-tennis-green-50 rounded-2xl text-sm text-gray-700 border border-tennis-green-100 flex gap-4 relative">
                                                                        <MessageSquare size={20} className="text-tennis-green-500 shrink-0 mt-1" />
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

                                                    {editingGame?.tournamentId === t.tournament_id && (
                                                        <div className="mt-12 p-10 bg-gray-900 rounded-[3rem] text-white shadow-3xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
                                                            <div className="absolute top-0 right-0 w-64 h-64 bg-tennis-green-600/10 blur-[100px] rounded-full"></div>
                                                            <div className="flex items-center justify-between mb-10 relative z-10">
                                                                <h6 className="font-black text-2xl tracking-tighter">Enter Match Result / 試合結果の記録</h6>
                                                                <button disabled={isProcessing} onClick={() => setEditingGame(null)} className="w-12 h-12 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-all active:scale-90 disabled:opacity-30"><X size={24} /></button>
                                                            </div>
                                                            
                                                            <div className="space-y-10 relative z-10">
                                                                <div>
                                                                    <label className="block text-xs font-black text-white/30 uppercase tracking-[0.3em] mb-4">Opponent Selection / 対戦相手</label>
                                                                    <div className="relative">
                                                                        <input disabled={isProcessing} type="text" className="w-full px-8 py-5 bg-white/10 border-2 border-white/10 rounded-2xl focus:border-tennis-green-400 outline-none pr-14 text-lg font-bold transition-all disabled:opacity-50" placeholder="対戦相手の氏名を検索..." value={opponentSearch} onChange={e => searchOpponents(e.target.value)} />
                                                                        <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20" size={24} />
                                                                        {opponentSuggestions.length > 0 && !isProcessing && (
                                                                        <div className="absolute top-full left-0 w-full mt-4 bg-white text-gray-900 rounded-[2rem] shadow-3xl z-50 overflow-hidden max-h-80 overflow-y-auto border-4 border-gray-900">
                                                                            {opponentSuggestions.map(p => (
                                                                            <button key={p.player_id} className="w-full text-left px-8 py-5 hover:bg-tennis-green-50 transition-colors border-b border-gray-100 last:border-0" onClick={() => { setEditingGame({...editingGame, game: {...editingGame.game, opponent1_id: p.player_id}}); setOpponentSuggestions([]); setOpponentSearch(p.full_name); }}>
                                                                                <div className="flex items-center justify-between font-black text-base">{p.full_name} <span className="text-xs text-tennis-green-600 bg-tennis-green-100 px-3 py-1 rounded-full">{p.ranking_point}pt</span></div>
                                                                                <div className="text-xs text-gray-500 mt-1">{p.team} | {p.category}</div>
                                                                            </button>
                                                                            ))}
                                                                        </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                                                    {[1, 2, 3, 4, 5].map(setNum => (
                                                                        <div key={setNum} className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                                                            <p className="text-[10px] font-black text-center mb-4 text-white/20 uppercase tracking-widest">Set {setNum}</p>
                                                                            <div className="flex gap-2">
                                                                                <input disabled={isProcessing} type="number" className="w-full bg-white text-gray-900 text-center py-3 rounded-xl font-black text-base disabled:opacity-50" value={(editingGame.game[`set${setNum}_self` as keyof Game] as number) || 0} onChange={e => setEditingGame({...editingGame, game: {...editingGame.game, [`set${setNum}_self`]: parseInt(e.target.value) || 0}})} />
                                                                                <input disabled={isProcessing} type="number" className="w-full bg-white text-gray-900 text-center py-3 rounded-xl font-black text-base disabled:opacity-50" value={(editingGame.game[`set${setNum}_opp` as keyof Game] as number) || 0} onChange={e => setEditingGame({...editingGame, game: {...editingGame.game, [`set${setNum}_opp`]: parseInt(e.target.value) || 0}})} />
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                    <div className="bg-tennis-green-500/20 p-4 rounded-2xl border border-tennis-green-500/40">
                                                                        <p className="text-[10px] font-black text-center mb-4 text-tennis-green-400 uppercase tracking-widest">TieBreak</p>
                                                                        <div className="flex gap-2">
                                                                            <input disabled={isProcessing} type="number" className="w-full bg-white text-gray-900 text-center py-3 rounded-xl font-black text-base border-2 border-tennis-green-500/20 disabled:opacity-50" value={editingGame.game.tb_self || 0} onChange={e => setEditingGame({...editingGame, game: {...editingGame.game, tb_self: parseInt(e.target.value) || 0}})} />
                                                                            <input disabled={isProcessing} type="number" className="w-full bg-white text-gray-900 text-center py-3 rounded-xl font-black text-base border-2 border-tennis-green-500/20 disabled:opacity-50" value={editingGame.game.tb_opp || 0} onChange={e => setEditingGame({...editingGame, game: {...editingGame.game, tb_opp: parseInt(e.target.value) || 0}})} />
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                                                    <div>
                                                                        <label className="block text-xs font-black text-white/30 uppercase tracking-[0.3em] mb-6">Outcome / 勝敗結果</label>
                                                                        <div className="flex gap-3">
                                                                            {['Win', 'Loss', 'Bye'].map(r => (
                                                                            <button disabled={isProcessing} key={r} onClick={() => setEditingGame({...editingGame, game: {...editingGame.game, result: r}})} className={`flex-1 py-5 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all disabled:opacity-50 ${editingGame.game.result === r ? 'bg-tennis-green-500 text-white shadow-2xl scale-105 z-10' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}>
                                                                                {r === 'Loss' ? 'Loser' : r === 'Win' ? 'Winner' : 'Bye'}
                                                                            </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-black text-white/30 uppercase tracking-[0.3em] mb-5">Custom Score / スコア修正</label>
                                                                        <input disabled={isProcessing} type="text" className="w-full px-8 py-5 bg-white/10 border-2 border-white/10 rounded-2xl focus:border-tennis-green-400 outline-none text-base font-bold disabled:opacity-50" value={editingGame.game.score || ''} onChange={e => setEditingGame({...editingGame, game: {...editingGame.game, score: e.target.value}})} />
                                                                    </div>
                                                                </div>

                                                                <div>
                                                                    <label className="block text-xs font-black text-white/30 uppercase tracking-[0.3em] mb-5">Post-Match Memo / 分析・感想</label>
                                                                    <textarea disabled={isProcessing} className="w-full px-8 py-6 bg-white/10 border-2 border-white/10 rounded-[2rem] focus:border-tennis-green-400 outline-none h-48 resize-none text-base font-medium leading-relaxed disabled:opacity-50" placeholder="この試合の振り返りや、次の課題などを入力してください..." value={editingGame.game.memo || ''} onChange={e => setEditingGame({...editingGame, game: {...editingGame.game, memo: e.target.value}})}></textarea>
                                                                </div>
                                                            </div>

                                                            <div className="flex gap-6 mt-12">
                                                                <button disabled={isProcessing} onClick={handleSaveGame} className="flex-1 py-6 bg-tennis-green-500 text-white rounded-[2rem] text-sm font-black hover:bg-tennis-green-400 shadow-3xl transform hover:-translate-y-1 transition-all active:scale-95 flex justify-center items-center gap-2">
                                                                    {isProcessing && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                                                                    記録を保存する
                                                                </button>
                                                                <button disabled={isProcessing} onClick={() => setEditingGame(null)} className="px-12 py-6 bg-white/10 text-white rounded-[2rem] text-sm font-bold hover:bg-white/20 transition-all disabled:opacity-50">キャンセル</button>
                                                            </div>
                                                        </div>
                                                    )}
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
