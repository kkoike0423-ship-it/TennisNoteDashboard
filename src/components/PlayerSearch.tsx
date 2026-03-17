import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import type { Player } from '../types/database';
import { useManagedPlayers } from '../contexts/ManagedPlayerContext';
import { Button, Input, Card } from './ui';

interface PlayerSearchProps {
    playerType: 'managed' | 'opponent';
    title: string;
}

export default function PlayerSearch({ playerType, title }: PlayerSearchProps) {
    const { activeManagedPlayerId } = useManagedPlayers();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Player[]>([]);
    const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
    const [watchedPlayersList, setWatchedPlayersList] = useState<Player[]>([]);
    const [ranks, setRanks] = useState<Record<string, number | null>>({});
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchWatched = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        let dbQuery = supabase
            .from('user_watched_players')
            .select('player_id')
            .eq('user_id', session.user.id)
            .eq('player_type', playerType);

        if (playerType === 'opponent') {
            if (!activeManagedPlayerId) {
                setWatchedIds(new Set());
                setWatchedPlayersList([]);
                setRanks({});
                return;
            }
            dbQuery = dbQuery.eq('target_managed_player_id', activeManagedPlayerId);
        }

        const { data, error } = await dbQuery;

        if (!error && data) {
            const ids = data.map(d => d.player_id);
            setWatchedIds(new Set(ids));

            if (ids.length > 0) {
                const { data: details } = await supabase.from('players').select('*').in('player_id', ids);

                if (details) {
                    const playersDetail = details as Player[];
                    setWatchedPlayersList(playersDetail);

                    // Optimized: Fetch all ranks in one query
                    const { data: ranksData } = await supabase
                        .from('category_rankings')
                        .select('player_id, rank, year_month, category')
                        .in('player_id', ids)
                        .order('year_month', { ascending: false });

                    const ranksMap: Record<string, number | null> = {};
                    ids.forEach(id => {
                        const player = playersDetail.find(p => p.player_id === id);
                        const newestRank = ranksData?.find(r => r.player_id === id && r.category === player?.category);
                        ranksMap[id] = newestRank?.rank || null;
                    });
                    setRanks(ranksMap);
                }
            } else {
                setWatchedPlayersList([]);
                setRanks({});
            }
        } else {
            setWatchedPlayersList([]);
            setWatchedIds(new Set());
            setRanks({});
        }
    }, [playerType, activeManagedPlayerId]);

    useEffect(() => {
        fetchWatched();
    }, [fetchWatched]);

    // Search DB based on query
    useEffect(() => {
        if (query.trim().length < 2) {
            const clearTimer = window.setTimeout(() => {
                setResults([]);
            }, 0);
            return () => window.clearTimeout(clearTimer);
        }

        const searchPlayers = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('players')
                .select('*')
                .or(`full_name.ilike.%${query}%,team.ilike.%${query}%,player_id.ilike.%${query}%`)
                .limit(20);

            if (!error && data) {
                setResults(data as Player[]);
            }
            setLoading(false);
        };

        const delayDebounceFn = setTimeout(() => {
            searchPlayers();
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    const handleToggleWatch = async (playerId: string) => {
        setActionLoading(playerId);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        if (watchedIds.has(playerId)) {
            // Remove
            const playerToRemove = watchedPlayersList.find(p => p.player_id === playerId) || 
                                 results.find(p => p.player_id === playerId);
            const playerName = playerToRemove ? (playerToRemove.full_name || `${playerToRemove.last_name} ${playerToRemove.first_name}`) : playerId;
            
            const confirmMsg = playerType === 'managed' 
                ? `「${playerName}」を管理リストから削除しますか？\n紐づく対戦相手の情報もすべて削除されます。`
                : `「${playerName}」をリストから削除しますか？`;

            if (!window.confirm(confirmMsg)) {
                setActionLoading(null);
                return;
            }

            if (playerType === 'managed') {
                // Delete associated opponents first
                await supabase
                    .from('user_watched_players')
                    .delete()
                    .eq('user_id', session.user.id)
                    .eq('target_managed_player_id', playerId);
            }

            let dbQuery = supabase
                .from('user_watched_players')
                .delete()
                .eq('user_id', session.user.id)
                .eq('player_id', playerId)
                .eq('player_type', playerType);

            if (playerType === 'opponent' && activeManagedPlayerId) {
                dbQuery = dbQuery.eq('target_managed_player_id', activeManagedPlayerId);
            }

            await dbQuery;

            setWatchedIds(prev => {
                const next = new Set(prev);
                next.delete(playerId);
                return next;
            });
        } else {
            // Add
            if (watchedIds.size >= 10) {
                alert("登録は最大10名までです。不要な選手を削除してから追加してください。");
                setActionLoading(null);
                return;
            }

            const insertData: {
                user_id: string;
                player_id: string;
                player_type: 'managed' | 'opponent';
                target_managed_player_id?: string;
            } = {
                user_id: session.user.id,
                player_id: playerId,
                player_type: playerType
            };

            if (playerType === 'opponent') {
                if (!activeManagedPlayerId) {
                    alert("管理選手を選択してから登録してください。");
                    setActionLoading(null);
                    return;
                }
                insertData.target_managed_player_id = activeManagedPlayerId;
            }

            await supabase
                .from('user_watched_players')
                .insert(insertData);

            setWatchedIds(prev => new Set(prev).add(playerId));
        }
        setActionLoading(null);
        // Refresh local list immediately
        const { data: { session: refreshSession } } = await supabase.auth.getSession();
        if (refreshSession) {
            let refreshQuery = supabase
                .from('user_watched_players')
                .select('player_id')
                .eq('user_id', refreshSession.user.id)
                .eq('player_type', playerType);
            if (playerType === 'opponent' && activeManagedPlayerId) {
                refreshQuery = refreshQuery.eq('target_managed_player_id', activeManagedPlayerId);
            }
            const { data: newIds } = await refreshQuery;
            if (newIds) {
                const ids = newIds.map(n => n.player_id);
                setWatchedIds(new Set(ids));
                if (ids.length > 0) {
                    const { data: details } = await supabase.from('players').select('*').in('player_id', ids);
                    if (details) {
                        const playersDetail = details as Player[];
                        setWatchedPlayersList(playersDetail);

                        // Optimized: single query for all ranks
                        const { data: refreshRanksData } = await supabase
                            .from('category_rankings')
                            .select('player_id, rank, year_month, category')
                            .in('player_id', ids)
                            .order('year_month', { ascending: false });

                        const ranksMap: Record<string, number | null> = {};
                        ids.forEach(id => {
                            const player = playersDetail.find(p => p.player_id === id);
                            const best = refreshRanksData?.find(r => r.player_id === id && r.category === player?.category);
                            ranksMap[id] = best?.rank ?? null;
                        });
                        setRanks(ranksMap);
                    }
                } else {
                    setWatchedPlayersList([]);
                    setRanks({});
                }
            }
        }
        window.dispatchEvent(new CustomEvent('watched-players-changed', { detail: { playerType } }));
    };

    return (
        <Card className="p-6 shadow-sm mt-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{title}</h3>

            <div className="relative mb-6">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <Input
                    className="pl-10"
                    type="text"
                    placeholder="名前、チーム、またはIDで検索 (例: 田中, TN-1, ライズ)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {loading && <Loader2 className="absolute right-3 top-3.5 h-5 w-5 text-tennis-green-500 animate-spin" />}
            </div>

            {/* Currently Registered Players List */}
            {query.length === 0 && watchedPlayersList.length > 0 && (
                <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <h4 className="text-sm font-semibold text-tennis-green-700 mb-3 bg-tennis-green-50 px-3 py-1 rounded inline-block">
                        現在登録されている選手 ({watchedPlayersList.length}/10)
                    </h4>
                    <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl bg-white/50 backdrop-blur-sm shadow-sm overflow-hidden">
                        {watchedPlayersList.map((player) => (
                            <li key={player.player_id} className="p-4 flex items-center justify-between hover:bg-white transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-gray-800">{player.full_name || `${player.last_name} ${player.first_name}`}</p>
                                            <span className="text-[10px] font-bold text-tennis-green-600 bg-tennis-green-50 px-2 py-0.5 rounded-full border border-tennis-green-100">
                                                {ranks[player.player_id] ? `${ranks[player.player_id]}位` : '-位'}
                                                <span className="text-tennis-green-400 font-normal ml-1">({player.ranking_point.toLocaleString()}pt)</span>
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-400 mt-1">
                                            <span>{player.team || 'チームなし'}</span>
                                            <span className="text-gray-200">•</span>
                                            <span>{player.category}</span>
                                            <span className="text-gray-200">•</span>
                                            <span className="font-mono">{player.player_id}</span>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="danger"
                                    size="icon"
                                    loading={actionLoading === player.player_id}
                                    onClick={() => handleToggleWatch(player.player_id)}
                                    disabled={actionLoading === player.player_id}
                                    title="登録解除"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Search Results */}
            {results.length > 0 ? (
                <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {results.map((player) => {
                        const isWatched = watchedIds.has(player.player_id);
                        return (
                            <li key={player.player_id} className="py-3 flex items-center justify-between group">
                                <div className="flex items-center gap-4 text-sm mt-1 text-gray-500">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-gray-800 text-base">{player.full_name || `${player.last_name} ${player.first_name}`}</p>
                                            <span className="text-[10px] font-bold text-tennis-green-600 bg-tennis-green-50 px-2 py-0.5 rounded-full border border-tennis-green-100">
                                                {player.ranking_point.toLocaleString()}pt
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-400 mt-1">
                                            <span>{player.team || 'チームなし'}</span>
                                            <span className="text-gray-200">•</span>
                                            <span>{player.category}</span>
                                            <span className="text-gray-200">•</span>
                                            <span className="font-mono">{player.player_id}</span>
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    variant={isWatched ? 'danger' : 'ghost'}
                                    size="icon"
                                    loading={actionLoading === player.player_id}
                                    onClick={() => handleToggleWatch(player.player_id)}
                                    disabled={actionLoading === player.player_id}
                                    title={isWatched ? '登録解除' : '登録'}
                                >
                                    {isWatched ? <Trash2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                </Button>
                            </li>
                        );
                    })}
                </ul>
            ) : query.length > 1 ? (
                <p className="text-gray-500 text-center py-4">該当する選手が見つかりません。</p>
            ) : null}
        </Card>
    );
}
