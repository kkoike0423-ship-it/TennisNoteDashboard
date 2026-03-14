import { useState, useEffect } from 'react';
import { Search, User, Users, TrendingUp, Trash2, Loader2, ChevronRight, X, UserPlus, Star } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import type { Player } from '../types/database';
import MultiPlayerChart from './MultiPlayerChart';

interface ScoutHubProps {
    activeManagedPlayerId: string | null;
}

export default function ScoutHub({ activeManagedPlayerId }: ScoutHubProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Player[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [rivals, setRivals] = useState<Player[]>([]);
    const [selectedRivalId, setSelectedRivalId] = useState<string | null>(null);
    const [searchGender, setSearchGender] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [managedPlayer, setManagedPlayer] = useState<Player | null>(null);

    // Fetch managed player details for comparison
    const fetchManagedPlayer = async () => {
        if (!activeManagedPlayerId) return;
        const { data } = await supabase
            .from('players')
            .select('*')
            .eq('player_id', activeManagedPlayerId)
            .single();
        if (data) {
            const p = data as Player;
            setManagedPlayer(p);
            // Default search gender to managed player's gender
            if (p.gender) setSearchGender(p.gender);
        }
    };

    // Fetch Rivals List
    const fetchRivals = async () => {
        if (!activeManagedPlayerId) {
            setRivals([]);
            setLoading(false);
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: watchedRecords } = await supabase
            .from('user_watched_players')
            .select('player_id')
            .eq('user_id', session.user.id)
            .eq('player_type', 'opponent')
            .eq('target_managed_player_id', activeManagedPlayerId);

        if (watchedRecords && watchedRecords.length > 0) {
            const pIds = watchedRecords.map(w => w.player_id);
            const { data: players } = await supabase
                .from('players')
                .select('*')
                .in('player_id', pIds);
            
            if (players) {
                setRivals(players as Player[]);
            }
        } else {
            setRivals([]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchRivals();
        fetchManagedPlayer();
    }, [activeManagedPlayerId]);

    // Handle Search
    useEffect(() => {
        if (searchQuery.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        const searchPlayers = async () => {
            let dbQuery = supabase
                .from('players')
                .select('*')
                .or(`full_name.ilike.%${searchQuery}%,team.ilike.%${searchQuery}%,player_id.ilike.%${searchQuery}%`);
            
            if (searchGender !== 'all') {
                dbQuery = dbQuery.eq('gender', searchGender);
            }

            const { data } = await dbQuery.limit(10);
            
            if (data) setSearchResults(data as Player[]);
            setIsSearching(false);
        };

        const timer = setTimeout(searchPlayers, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleAddRival = async (player: Player) => {
        if (!activeManagedPlayerId) return;
        setActionLoading(player.player_id);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { error } = await supabase
            .from('user_watched_players')
            .insert({
                user_id: session.user.id,
                player_id: player.player_id,
                player_type: 'opponent',
                target_managed_player_id: activeManagedPlayerId
            });

        if (!error) {
            setSearchQuery('');
            await fetchRivals();
            setSelectedRivalId(player.player_id);
            window.dispatchEvent(new CustomEvent('watched-players-changed', { detail: { playerType: 'opponent' } }));
        }
        setActionLoading(null);
    };

    const handleRemoveRival = async (playerId: string) => {
        if (!activeManagedPlayerId) return;
        if (!window.confirm('ライバル登録を解除しますか？')) return;
        
        setActionLoading(playerId);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        await supabase
            .from('user_watched_players')
            .delete()
            .eq('user_id', session.user.id)
            .eq('player_id', playerId)
            .eq('player_type', 'opponent')
            .eq('target_managed_player_id', activeManagedPlayerId);

        if (selectedRivalId === playerId) setSelectedRivalId(null);
        await fetchRivals();
        window.dispatchEvent(new CustomEvent('watched-players-changed', { detail: { playerType: 'opponent' } }));
        setActionLoading(null);
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-24">
            {/* Search Bar */}
            <div className="sticky top-0 z-20 bg-tennis-green-50/80 backdrop-blur-md pt-2 pb-4">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="選手名、チーム名で検索..."
                        className="w-full pl-12 pr-12 py-4 bg-white border-2 border-tennis-green-100 rounded-2xl shadow-sm focus:border-tennis-green-500 focus:ring-0 outline-none transition-all text-lg"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {isSearching ? (
                        <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-tennis-green-500 animate-spin" />
                    ) : searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400">
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Gender Toggle for search */}
                {searchQuery.length >= 2 && (
                    <div className="mt-3 flex items-center gap-4 px-2">
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1"><Users size={12}/> 検索対象:</span>
                        <div className="flex bg-white/50 p-0.5 rounded-lg border border-tennis-green-100">
                            {['all', '男子', '女子'].map(g => (
                                <button
                                    key={g}
                                    onClick={() => setSearchGender(g)}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${searchGender === g
                                        ? 'bg-tennis-green-600 text-white shadow-sm'
                                        : 'text-gray-400 hover:text-gray-600'
                                    }`}
                                >
                                    {g === 'all' ? 'すべて' : g}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Search Results Overlay */}
                {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-xl border border-tennis-green-100 overflow-hidden z-30 max-h-[60vh] overflow-y-auto">
                        {searchResults.map(player => {
                            const isManaged = player.player_id === activeManagedPlayerId;
                            const isAlreadyRival = rivals.some(r => r.player_id === player.player_id);
                            
                            return (
                                <div key={player.player_id} className="p-4 flex items-center justify-between hover:bg-tennis-green-50 transition-colors border-b border-gray-50 last:border-none">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-tennis-green-100 flex items-center justify-center text-tennis-green-600 font-bold">
                                            {player.last_name?.[0] || <User size={20} />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800">
                                                {player.full_name}
                                                {isManaged && <span className="ml-2 text-[8px] bg-tennis-green-100 text-tennis-green-600 px-1 py-0.5 rounded">管理選手</span>}
                                            </p>
                                            <p className="text-xs text-gray-500">{player.team} | {player.category}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => !isManaged && handleAddRival(player)}
                                        disabled={isManaged || actionLoading === player.player_id || isAlreadyRival}
                                        className={`p-2 rounded-full transition-all ${
                                            isManaged || isAlreadyRival
                                                ? 'text-tennis-green-500 bg-tennis-green-50 cursor-default opacity-50'
                                                : 'text-gray-400 hover:text-tennis-green-600 hover:bg-tennis-green-50'
                                        }`}
                                    >
                                        {isAlreadyRival ? <Star size={24} fill="currentColor" /> : <UserPlus size={24} />}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {!selectedRivalId ? (
                /* Rivals List Phase */
                <div className="space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Star className="text-amber-400" size={20} fill="currentColor" /> 登録済みライバル
                            </h3>
                            <span className="text-xs font-bold text-gray-400 bg-white px-2 py-1 rounded-full border">{rivals.length} / 10</span>
                        </div>

                        {loading ? (
                            <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                                <Loader2 className="animate-spin mb-2" />
                                <p className="text-sm">読み込み中...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {rivals.map(rival => (
                                    <button
                                        key={rival.player_id}
                                        onClick={() => setSelectedRivalId(rival.player_id)}
                                        className="p-4 bg-white rounded-2xl shadow-sm border border-tennis-green-50 flex items-center justify-between hover:border-tennis-green-200 transition-all active:scale-[0.98]"
                                    >
                                        <div className="flex items-center gap-4 text-left">
                                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xl">
                                                {rival.last_name?.[0] || '選'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800 text-lg">{rival.full_name}</p>
                                                <p className="text-sm text-gray-500">{rival.team || '所属なし'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-tennis-green-600">{rival.ranking_point.toLocaleString()} <span className="text-[10px]">pt</span></p>
                                                <p className="text-[10px] text-gray-400 line-clamp-1">{rival.category}</p>
                                            </div>
                                            <ChevronRight size={20} className="text-gray-300" />
                                        </div>
                                    </button>
                                ))}

                                {rivals.length === 0 && !loading && (
                                    <div className="py-14 bg-white/50 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center px-6">
                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-300">
                                            <Search size={24} />
                                        </div>
                                        <h4 className="text-sm font-bold text-gray-500">ライバルが未登録です</h4>
                                        <p className="text-xs text-gray-400 mt-1">上の検索窓から選手を登録しましょう。</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Show overall trends if rivals exist */}
                    {rivals.length > 0 && (
                        <div className="space-y-4">
                             <h3 className="text-lg font-bold text-gray-800 px-2 flex items-center gap-2">
                                <TrendingUp className="text-tennis-green-600" size={20} /> ライバル勢の勢力図
                             </h3>
                             <MultiPlayerChart 
                                playerType="opponent" 
                                title="全体のランキング推移" 
                                activeManagedPlayerId={activeManagedPlayerId}
                             />
                        </div>
                    )}
                </div>
            ) : (
                /* Comparison Phase */
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <button 
                        onClick={() => setSelectedRivalId(null)}
                        className="flex items-center gap-2 text-tennis-green-700 font-bold px-2 py-1"
                    >
                        ← ライバル一覧に戻る
                    </button>

                    <div className="glass-panel p-6 shadow-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <TrendingUp size={120} />
                        </div>
                        
                        <div className="flex items-center justify-between relative z-10 gap-2">
                            {/* Comparison Cards */}
                            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl sm:text-2xl border-4 border-white shadow-sm shrink-0">
                                    我
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 text-center truncate w-full">{managedPlayer?.last_name || 'わが子'}</p>
                            </div>

                            <div className="shrink-0">
                                <div className="bg-tennis-green-500 text-white font-black text-[10px] sm:text-xs px-2 py-1 sm:px-3 sm:py-1 rounded-full shadow-sm">VS</div>
                            </div>

                            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-xl sm:text-2xl border-4 border-white shadow-sm shrink-0">
                                    {rivals.find(r => r.player_id === selectedRivalId)?.last_name?.[0] || '敵'}
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 text-center truncate w-full">{rivals.find(r => r.player_id === selectedRivalId)?.full_name}</p>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-gray-50/50 p-3 rounded-xl text-center flex flex-col justify-center border border-gray-100/50">
                                <p className="text-[10px] text-gray-400 font-black mb-1 uppercase tracking-wider whitespace-nowrap">Point Difference</p>
                                <p className="text-lg font-black text-gray-900 whitespace-nowrap">
                                    {(() => {
                                        const r = rivals.find(r => r.player_id === selectedRivalId);
                                        const rPoint = r?.ranking_point || 0;
                                        const mPoint = managedPlayer?.ranking_point || 0;
                                        const diff = rPoint - mPoint;
                                        const sign = diff > 0 ? '+' : '';
                                        const colorClass = diff > 0 ? 'text-rose-500' : diff < 0 ? 'text-blue-500' : 'text-gray-500';
                                        return <span className={colorClass}>{sign}{diff.toLocaleString()}pt</span>;
                                    })()}
                                </p>
                            </div>
                            <button 
                                onClick={() => handleRemoveRival(selectedRivalId)}
                                className="flex flex-col items-center justify-center gap-1 p-3 bg-rose-50/50 text-rose-500 rounded-xl text-[10px] font-black hover:bg-rose-500 hover:text-white transition-all border border-rose-100 group/del"
                            >
                                <Trash2 size={16} className="group-hover/del:scale-110 transition-transform" />
                                <span>ライバル登録を解除</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl shadow-sm border border-tennis-green-50 overflow-hidden min-h-[400px]">
                         <MultiPlayerChart 
                             playerType="opponent" 
                             title="ランキング推移比較" 
                             activeManagedPlayerId={activeManagedPlayerId}
                             forceSelectedPlayerIds={[activeManagedPlayerId!, selectedRivalId!]}
                         />
                    </div>
                </div>
            )}
        </div>
    );
}
