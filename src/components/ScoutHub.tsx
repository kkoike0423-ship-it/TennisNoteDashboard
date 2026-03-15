import { useState, useEffect } from "react";
import { Search, UserPlus, Star, Loader2, User, Trash2 } from "lucide-react";
import { supabase } from "../utils/supabaseClient";
import MultiPlayerChart from "./MultiPlayerChart";

interface Player {
    player_id: string;
    full_name: string;
    last_name: string;
    team: string;
    category: string;
    ranking_point: number;
    gender: string;
}

interface ScoutHubProps {
    activeManagedPlayerId: string | null;
}

export default function ScoutHub({ activeManagedPlayerId }: ScoutHubProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Player[]>([]);
    const [rivals, setRivals] = useState<Player[]>([]);
    const [managedPlayer, setManagedPlayer] = useState<Player | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [hiddenRivalIds, setHiddenRivalIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (activeManagedPlayerId) {
            fetchManagedPlayer();
            fetchRivals();
        }
    }, [activeManagedPlayerId]);

    const fetchManagedPlayer = async () => {
        const { data, error } = await supabase
            .from("players")
            .select("*")
            .eq("player_id", activeManagedPlayerId)
            .single();
        
        if (!error && data) {
            setManagedPlayer(data as Player);
        }
    };

    const fetchRivals = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: watchedData, error: watchedError } = await supabase
                .from("user_watched_players")
                .select("player_id")
                .eq("user_id", session.user.id)
                .eq("target_managed_player_id", activeManagedPlayerId)
                .eq("player_type", "opponent");

            if (watchedError) throw watchedError;

            if (watchedData && watchedData.length > 0) {
                const rivalIds = watchedData.map((w: { player_id: string }) => w.player_id);
                const { data: playersData, error: playersError } = await supabase
                    .from("players")
                    .select("*")
                    .in("player_id", rivalIds);

                if (playersError) throw playersError;
                setRivals(playersData as Player[] || []);
            } else {
                setRivals([]);
            }
        } catch (error) {
            console.error("Error fetching rivals:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        const { data, error } = await supabase
            .from("players")
            .select("*")
            .or(`full_name.ilike.%${query}%,last_name.ilike.%${query}%`)
            .limit(10);

        if (!error && data) {
            setSearchResults(data as Player[]);
        }
    };

    const handleAddRival = async (player: Player) => {
        if (!activeManagedPlayerId) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        setActionLoading(player.player_id);

        try {
            const { error } = await supabase
                .from("user_watched_players")
                .insert({
                    user_id: session.user.id,
                    target_managed_player_id: activeManagedPlayerId,
                    player_id: player.player_id,
                    player_type: 'opponent'
                });

            if (error) throw error;
            
            setRivals(prev => [...prev, player]);
            // Removed clearing of search results to allow immediate toggle
            
            // Notify other components
            window.dispatchEvent(new CustomEvent('watched-players-changed', { detail: { playerType: 'opponent' } }));
        } catch (error) {
            console.error("Error adding rival:", error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleToggleVisibility = (playerId: string) => {
        setHiddenRivalIds(prev => {
            const next = new Set(prev);
            if (next.has(playerId)) {
                next.delete(playerId);
            } else {
                next.add(playerId);
            }
            // Emit event to notify MultiPlayerChart
            window.dispatchEvent(new CustomEvent('player-visibility-changed', { 
                detail: { playerType: 'opponent', hiddenIds: Array.from(next) } 
            }));
            return next;
        });
    };

    const handleRemoveRival = async (rivalId: string) => {
        if (!activeManagedPlayerId) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        setActionLoading(rivalId);
        
        try {
            const { error } = await supabase
                .from("user_watched_players")
                .delete()
                .eq("user_id", session.user.id)
                .eq("target_managed_player_id", activeManagedPlayerId)
                .eq("player_id", rivalId)
                .eq("player_type", 'opponent');

            if (error) throw error;
            setRivals(prev => prev.filter(r => r.player_id !== rivalId));

            // Notify other components
            window.dispatchEvent(new CustomEvent('watched-players-changed', { detail: { playerType: 'opponent' } }));
        } catch (error) {
            console.error("Error removing rival:", error);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-32">
            <div className="relative">
                <div className="glass-panel p-4 flex items-center gap-3 bg-gray-50">
                    <Search className="text-gray-400" size={20} />
                    <input 
                        type="search" 
                        placeholder="ライバル選手を検索して登録..." 
                        className="flex-1 bg-transparent outline-none text-gray-800 placeholder:text-gray-400 font-medium"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                </div>

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
                                        onClick={() => {
                                            if (isManaged) return;
                                            if (isAlreadyRival) {
                                                handleRemoveRival(player.player_id);
                                            } else {
                                                handleAddRival(player);
                                            }
                                        }}
                                        disabled={isManaged || actionLoading === player.player_id}
                                        className={`p-2 rounded-full transition-all ${
                                            isManaged
                                                ? "text-gray-200 cursor-default opacity-50"
                                                : isAlreadyRival
                                                    ? "text-tennis-green-600 bg-tennis-green-50 hover:bg-tennis-green-100"
                                                    : "text-gray-400 hover:text-tennis-green-600 hover:bg-tennis-green-50"
                                        }`}
                                    >
                                        {actionLoading === player.player_id ? (
                                            <Loader2 size={24} className="animate-spin" />
                                        ) : isAlreadyRival ? (
                                            <Star size={24} fill="currentColor" />
                                        ) : (
                                            <UserPlus size={24} />
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="space-y-6">
                <div className="glass-panel p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                            <Star className="text-amber-400" fill="currentColor" size={20} />
                            登録ライバル一覧
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full ml-2">{rivals.length} / 10</span>
                        </h3>
                    </div>
                    
                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                            <Loader2 className="animate-spin mb-2" />
                            <p className="text-sm">読み込み中...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {rivals.map(rival => {
                                const mPoint = managedPlayer?.ranking_point || 0;
                                const rPoint = rival.ranking_point || 0;
                                const diff = rPoint - mPoint;
                                const sign = diff > 0 ? "+" : "";
                                const diffColorClass = diff > 0 ? "text-rose-500" : diff < 0 ? "text-blue-500" : "text-gray-400";

                                return (
                                    <div
                                        key={rival.player_id}
                                        className="relative group"
                                    >
                                        <button
                                            onClick={() => handleToggleVisibility(rival.player_id)}
                                            className={`w-full p-4 rounded-2xl shadow-sm border flex items-center justify-between transition-all text-left ${
                                                hiddenRivalIds.has(rival.player_id)
                                                ? "bg-gray-50 border-gray-100 opacity-60"
                                                : "bg-white border-tennis-green-50 hover:border-tennis-green-200 hover:shadow-md"
                                            }`}
                                        >
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl shrink-0 transition-colors ${
                                                    hiddenRivalIds.has(rival.player_id)
                                                    ? "bg-gray-200 text-gray-400"
                                                    : "bg-tennis-green-100 text-tennis-green-600 group-hover:bg-tennis-green-50"
                                                }`}>
                                                    {rival.last_name?.[0]}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className={`font-bold text-lg truncate ${
                                                            hiddenRivalIds.has(rival.player_id) ? "text-gray-400" : "text-gray-800"
                                                        }`}>{rival.full_name}</p>
                                                        <span className={`text-xs font-black px-2 py-0.5 rounded shadow-sm ${
                                                            hiddenRivalIds.has(rival.player_id) ? "bg-gray-100 text-gray-300" : `bg-gray-50 ${diffColorClass}`
                                                        }`}>
                                                            {sign}{diff.toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-400 truncate">{rival.team || "所属なし"}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 ml-2">
                                                <p className={`text-sm font-black ${
                                                    hiddenRivalIds.has(rival.player_id) ? "text-gray-300" : "text-gray-800"
                                                }`}>{rPoint.toLocaleString()} <span className="text-[10px] font-bold">pt</span></p>
                                                <p className="text-[10px] text-gray-400 font-bold">{rival.category}</p>
                                            </div>
                                        </button>
                                        
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveRival(rival.player_id);
                                            }}
                                            className="absolute -top-2 -right-2 w-8 h-8 bg-white text-rose-400 rounded-full shadow-md border border-gray-100 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                                            title="削除"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                            
                            {rivals.length === 0 && !loading && (
                                <div className="py-14 bg-white/50 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center px-6 md:col-span-2">
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

                <div className="bg-white rounded-3xl shadow-sm border border-tennis-green-50 overflow-hidden min-h-[400px] sm:min-h-[500px]">
                    <MultiPlayerChart 
                        playerType="opponent" 
                        title="ライバル比較グラフ" 
                        activeManagedPlayerId={activeManagedPlayerId}
                        showControls={false}
                    />
                </div>
            </div>
        </div>
    );
}