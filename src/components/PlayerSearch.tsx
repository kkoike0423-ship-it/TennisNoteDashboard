import { useState, useEffect } from 'react';
import { Search, Plus, Check, Loader2, User } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import type { Player } from '../types/database';

interface PlayerSearchProps {
    playerType: 'managed' | 'opponent';
    title: string;
}

export default function PlayerSearch({ playerType, title }: PlayerSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Player[]>([]);
    const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Fetch initial watched players
    useEffect(() => {
        const fetchWatched = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data, error } = await supabase
                .from('user_watched_players')
                .select('player_id')
                .eq('user_id', session.user.id)
                .eq('player_type', playerType);

            if (!error && data) {
                setWatchedIds(new Set(data.map(d => d.player_id)));
            }
        };
        fetchWatched();
    }, [playerType]);

    // Search DB based on query
    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            return;
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
            await supabase
                .from('user_watched_players')
                .delete()
                .eq('user_id', session.user.id)
                .eq('player_id', playerId)
                .eq('player_type', playerType);

            setWatchedIds(prev => {
                const next = new Set(prev);
                next.delete(playerId);
                return next;
            });
        } else {
            // Add
            if (watchedIds.size >= 20) {
                alert("You can watch a maximum of 20 players at a time.");
                setActionLoading(null);
                return;
            }

            await supabase
                .from('user_watched_players')
                .insert({ user_id: session.user.id, player_id: playerId, player_type: playerType });

            setWatchedIds(prev => new Set(prev).add(playerId));
        }
        setActionLoading(null);
        window.dispatchEvent(new CustomEvent('watched-players-changed', { detail: { playerType } }));
    };

    return (
        <div className="glass-panel p-6 shadow-sm mt-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{title}</h3>

            <div className="relative mb-6">
                <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                <input
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-tennis-green-500 focus:border-transparent outline-none transition-all bg-white/70"
                    type="text"
                    placeholder="Search by name, team, or ID (e.g., Tanaka, TN-1, Alpha Team)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {loading && <Loader2 className="absolute right-3 top-3.5 h-5 w-5 text-tennis-green-500 animate-spin" />}
            </div>

            {results.length > 0 ? (
                <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {results.map((player) => {
                        const isWatched = watchedIds.has(player.player_id);
                        return (
                            <li key={player.player_id} className="py-3 flex items-center justify-between group">
                                <div className="flex items-center gap-4 text-sm mt-1 text-gray-500">
                                    <div className="w-10 h-10 rounded-full bg-tennis-green-100 flex items-center justify-center text-tennis-green-700">
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-800 text-base">{player.full_name || `${player.last_name} ${player.first_name}`}</p>
                                        <div className="flex gap-3 text-xs">
                                            <span>{player.team || 'No Team'}</span>
                                            <span>•</span>
                                            <span>{player.category}</span>
                                            <span>•</span>
                                            <span className="font-mono text-gray-400">{player.player_id}</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleToggleWatch(player.player_id)}
                                    disabled={actionLoading === player.player_id}
                                    className={`p-2 rounded-full transition-all flex items-center justify-center w-10 h-10 ${isWatched
                                        ? 'bg-tennis-green-500 text-white hover:bg-red-500 group-hover:bg-red-50 hover:text-red-600'
                                        : 'bg-gray-100 text-gray-500 hover:bg-tennis-green-100 hover:text-tennis-green-600'
                                        }`}
                                    title={isWatched ? "Remove from watched" : "Add to watched"}
                                >
                                    {actionLoading === player.player_id ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : isWatched ? (
                                        <Check className="w-5 h-5 pointer-events-none group-hover:hidden" />
                                    ) : (
                                        <Plus className="w-5 h-5" />
                                    )}
                                    {isWatched && <span className="hidden group-hover:block text-xs font-bold -ml-[2px] mt-[1px]">✕</span>}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : query.length > 1 ? (
                <p className="text-gray-500 text-center py-4">No players found matching your query.</p>
            ) : null}
        </div>
    );
}
