import { useState, useEffect } from "react";
import { Search, Star, Loader2, Trash2 } from "lucide-react";
import { supabase } from "../utils/supabaseClient";
import MultiPlayerChart from "./MultiPlayerChart";
import { useManagedPlayers } from "../contexts/ManagedPlayerContext";
import { Button, Input, Card } from "./ui";

interface Player {
    player_id: string;
    full_name: string;
    last_name: string;
    team: string;
    category: string;
    ranking_point: number;
    gender: string;
}

export default function ScoutHub() {
    const { activeManagedPlayerId, activeManagedPlayer } = useManagedPlayers();
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Player[]>([]);
    const [rivals, setRivals] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [hiddenRivalIds, setHiddenRivalIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (activeManagedPlayerId) {
            fetchRivals();
        }
    }, [activeManagedPlayerId]);

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
                
                // Sort rivals by ranking points (desc)
                const sortedRivals = (playersData as Player[] || []).sort((a, b) => b.ranking_point - a.ranking_point);
                setRivals(sortedRivals);
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
        if (query.trim().length < 1) {
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
        setActionLoading(player.player_id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { error } = await supabase
                .from("user_watched_players")
                .insert([{
                    user_id: session.user.id,
                    player_id: player.player_id,
                    player_type: "opponent",
                    target_managed_player_id: activeManagedPlayerId
                }]);

            if (error) throw error;
            await fetchRivals();
            setSearchQuery("");
            setSearchResults([]);
        } catch (error) {
            console.error("Error adding rival:", error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteRival = async (rivalId: string) => {
        if (!activeManagedPlayerId || !window.confirm("この対戦相手をリストから削除しますか？")) return;
        setActionLoading(rivalId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { error } = await supabase
                .from("user_watched_players")
                .delete()
                .eq("user_id", session.user.id)
                .eq("player_id", rivalId)
                .eq("target_managed_player_id", activeManagedPlayerId)
                .eq("player_type", "opponent");

            if (error) throw error;
            setRivals(prev => prev.filter(r => r.player_id !== rivalId));
        } catch (error) {
            console.error("Error deleting rival:", error);
        } finally {
            setActionLoading(null);
        }
    };

    const toggleRivalVisibility = (rivalId: string) => {
        setHiddenRivalIds(prev => {
            const next = new Set(prev);
            if (next.has(rivalId)) next.delete(rivalId);
            else next.add(rivalId);
            return next;
        });
    };



    if (!activeManagedPlayerId) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Star className="text-gray-300" size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">管理選手が選択されていません</h3>
                <p className="text-gray-500 mt-2">ダッシュボードで選手を選択するか、新しく登録してください。</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20">
            <header className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-tennis-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-tennis-green-100">
                        <Search className="text-white" size={20} />
                    </div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">対戦相手</h2>
                </div>
                <p className="text-sm text-gray-500 font-medium">
                    <span className="font-black text-tennis-green-600">{activeManagedPlayer?.full_name || "選手"}</span> さんの対戦相手を登録・分析します。
                </p>
            </header>

            <div className="grid grid-cols-1 gap-8">
                <Card className="p-6">
                    <div className="relative">
                        <Input
                            placeholder="名前で対戦相手を検索..."
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="bg-gray-50 border-gray-100 text-lg font-bold h-14 pl-12"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    </div>

                    {searchResults.length > 0 && (
                        <div className="mt-4 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                            {searchResults.map(p => {
                                const isManaged = p.player_id === activeManagedPlayerId;
                                const isAlreadyRival = rivals.some(r => r.player_id === p.player_id);
                                return (
                                    <div key={p.player_id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                                        <div>
                                            <p className="font-black text-gray-900">{p.full_name}</p>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{p.team} | {p.category}</p>
                                        </div>
                                        <Button
                                            disabled={isManaged || isAlreadyRival || actionLoading === p.player_id}
                                            onClick={() => handleAddRival(p)}
                                            size="sm"
                                            variant={isAlreadyRival ? "secondary" : "primary"}
                                        >
                                            {actionLoading === p.player_id ? <Loader2 className="animate-spin" size={16} /> : 
                                             isAlreadyRival ? "登録済み" : isManaged ? "本人" : "追加"}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">対戦相手リスト</h3>
                        <span className="text-xs font-bold bg-tennis-green-100 text-tennis-green-700 px-3 py-1 rounded-full">{rivals.length} Players</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {loading ? (
                            <div className="col-span-full py-10 flex justify-center"><Loader2 className="animate-spin text-tennis-green-600" size={32} /></div>
                        ) : rivals.length === 0 ? (
                            <div className="col-span-full py-16 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                                <p className="text-gray-400 font-bold">まだ対戦相手が登録されていません。</p>
                            </div>
                        ) : (
                            rivals.map(rival => {
                                const isHidden = hiddenRivalIds.has(rival.player_id);
                                return (
                                    <Card key={rival.player_id} className={`p-4 transition-all ${isHidden ? "opacity-50 grayscale" : "shadow-lg bg-white"}`}>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={() => toggleRivalVisibility(rival.player_id)}
                                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isHidden ? "bg-gray-100 text-gray-300" : "bg-tennis-green-100 text-tennis-green-600"}`}
                                                >
                                                    <Star size={20} fill={isHidden ? "transparent" : "currentColor"} />
                                                </button>
                                                <div>
                                                    <h4 className="font-black text-gray-900 truncate max-w-[120px]">{rival.full_name}</h4>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{rival.category}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-tennis-green-600">{rival.ranking_point}pt</p>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">RANKING</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                                            <span className="text-[10px] font-bold text-gray-500 truncate max-w-[150px]">{rival.team}</span>
                                            <button 
                                                onClick={() => handleDeleteRival(rival.player_id)}
                                                disabled={actionLoading === rival.player_id}
                                                className="p-2 text-gray-300 hover:text-rose-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">ランキング比較</h3>
                    <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border border-gray-50">
                        <MultiPlayerChart
                            playerType="opponent"
                            title=""
                            activeManagedPlayerId={activeManagedPlayerId}
                            showControls={false}
                        />
                    </div>
                    <p className="text-[10px] text-center font-bold text-gray-400 uppercase tracking-widest">
                        ※ 対戦相手名の星アイコンをクリックしてチャートの表示/非表示を切り替えられます。
                    </p>
                </div>
            </div>
        </div>
    );
}