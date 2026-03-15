import { useState, useEffect } from 'react';
import { Search, Database, Users, Calendar, AlertCircle, Loader2, Table } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import type { Player, CategoryRanking } from '../types/database';

interface DisplayData {
    player: Player;
    ranking: CategoryRanking | null;
}

interface DataManagementProps {
    initialCategory?: string;
    initialGender?: string;
}

export default function DataManagement({ initialCategory, initialGender }: DataManagementProps) {
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [displayData, setDisplayData] = useState<DisplayData[]>([]);
    const [yearMonth, setYearMonth] = useState<string>('');
    const [selectedGender, setSelectedGender] = useState<string>('all');
    const [availableGenders, setAvailableGenders] = useState<string[]>([]);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [activeManagedPlayerId, setActiveManagedPlayerId] = useState<string | null>(null);
    const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchCategories = async () => {
            const { data } = await supabase
                .from('players')
                .select('category')
                .not('category', 'is', null);

            if (data) {
                const uniqueCats = Array.from(new Set(data.map(c => c.category))).sort();
                setCategories(uniqueCats);
                if (uniqueCats.length > 0) {
                    setSelectedCategory(initialCategory || 'U11'); 
                }
            }
        };

        const fetchGenders = async () => {
            const { data } = await supabase
                .from('players')
                .select('gender')
                .not('gender', 'is', null);

            if (data) {
                const uniqueGenders = Array.from(new Set(data.map(g => g.gender))).sort();
                setAvailableGenders(uniqueGenders);
            }
        };

        if (initialGender) {
            setSelectedGender(initialGender);
        }

        const fetchUserPreferences = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: watched } = await supabase
                .from('user_watched_players')
                .select('player_id, player_type')
                .eq('user_id', session.user.id);

            if (watched) {
                setWatchedIds(new Set(watched.map(w => w.player_id)));
                
                // Also find the active managed player
                const managed = watched.find(w => w.player_type === 'managed');
                if (managed) setActiveManagedPlayerId(managed.player_id);
            }
        };

        fetchCategories();
        fetchGenders();
        fetchUserPreferences();
    }, [initialCategory, initialGender]);

    useEffect(() => {
        const fetchData = async () => {
            if (!selectedCategory) return;
            setLoading(true);

            // 1. Get latest rankings for this category
            const { data: rankings } = await supabase
                .from('category_rankings')
                .select('*')
                .eq('category', selectedCategory)
                .order('year_month', { ascending: false })
                .order('rank', { ascending: true })
                .limit(200);

            if (rankings && rankings.length > 0) {
                setYearMonth(rankings[0].year_month);

                // 2. Get player details for these rankings
                const playerIds = rankings.map(r => r.player_id);
                const { data: players } = await supabase
                    .from('players')
                    .select('*')
                    .in('player_id', playerIds);

                if (players) {
                    const combined = rankings.map(r => ({
                        ranking: r,
                        player: players.find(p => p.player_id === r.player_id) as Player
                    })).filter(item => item.player); // Ensure we have player info

                    setDisplayData(combined);
                }
            } else {
                setDisplayData([]);
                setYearMonth('-');
            }
            setLoading(false);
        };
        fetchData();
    }, [selectedCategory]);

    const handleAction = async (player: Player, type: 'managed' | 'opponent') => {
        setActionLoading(`${player.player_id}-${type}`);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            alert('ログインが必要です');
            setActionLoading(null);
            return;
        }

        if (type === 'opponent' && !activeManagedPlayerId) {
            alert('先にマイダッシュボードで「管理選手」を登録してください。');
            setActionLoading(null);
            return;
        }

        if (watchedIds.has(player.player_id)) {
            // Remove
            let dbDelete = supabase
                .from('user_watched_players')
                .delete()
                .eq('user_id', session.user.id)
                .eq('player_id', player.player_id)
                .eq('player_type', type);

            if (type === 'opponent' && activeManagedPlayerId) {
                dbDelete = dbDelete.eq('target_managed_player_id', activeManagedPlayerId);
            }

            const { error } = await dbDelete;

            if (error) {
                alert('エラーが発生しました。');
            } else {
                setWatchedIds(prev => {
                    const next = new Set(prev);
                    next.delete(player.player_id);
                    return next;
                });
                window.dispatchEvent(new CustomEvent('watched-players-changed', { detail: { playerType: type } }));
            }
        } else {
            // Add
            const { error } = await supabase
                .from('user_watched_players')
                .insert({
                    user_id: session.user.id,
                    player_id: player.player_id,
                    player_type: type,
                    target_managed_player_id: type === 'opponent' ? activeManagedPlayerId : null
                });

            if (error) {
                if (error.code === '23505') {
                    alert('既に登録されています。');
                } else {
                    alert('エラーが発生しました。');
                }
            } else {
                setWatchedIds(prev => new Set(prev).add(player.player_id));
                window.dispatchEvent(new CustomEvent('watched-players-changed', { detail: { playerType: type } }));
            }
        }
        setActionLoading(null);
    };

    const filteredData = displayData.filter(item => {
        const matchesSearch = item.player.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.player.team?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesGender = selectedGender === 'all' || 
            (item.player.gender?.trim() === selectedGender?.trim());
        return matchesSearch && matchesGender;
    });

    return (
        <div className="space-y-6 container mx-auto px-4 py-8 max-w-7xl animate-fade-in">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-tennis-green-100 pb-6">
                <div>
                    <h1 className="text-3xl font-black font-display text-tennis-green-900 flex items-center tracking-tight">
                        <Database className="mr-3 h-8 w-8 text-tennis-green-600" />
                        ランキング
                    </h1>
                    <p className="text-tennis-green-600 font-bold mt-1">
                        愛知県の選手と最新ランキングをカテゴリー別に閲覧できます。
                    </p>
                </div>
                <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-tennis-green-100 shrink-0">
                    <div className="flex items-center px-3 py-1.5 sm:px-4 sm:py-2 text-tennis-green-600 bg-tennis-green-50 rounded-xl whitespace-nowrap">
                        <Calendar size={14} className="mr-2 sm:size-[18px]" />
                        <span className="text-[10px] sm:text-sm font-bold">最新: {yearMonth}</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 shadow-sm flex flex-col gap-4">
                    <label className="text-sm font-bold text-gray-600 flex items-center gap-2">
                        <Users size={16} /> 性別
                    </label>
                    <div className="flex flex-wrap bg-gray-100 p-1 rounded-xl gap-1">
                        <button
                            onClick={() => setSelectedGender('all')}
                            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all ${selectedGender === 'all'
                                    ? 'bg-white text-tennis-green-600 shadow-sm'
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            すべて
                        </button>
                        {availableGenders.map(g => (
                            <button
                                key={g}
                                onClick={() => setSelectedGender(g)}
                                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all ${selectedGender === g
                                        ? 'bg-white text-tennis-green-600 shadow-sm'
                                        : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="md:col-span-1 glass-panel p-6 shadow-sm flex flex-col gap-4">
                    <label className="text-sm font-bold text-gray-600 flex items-center gap-2">
                        <Table size={16} /> カテゴリー
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedCategory === cat
                                        ? 'bg-tennis-green-500 text-white shadow-md transform scale-105'
                                        : 'bg-white text-gray-500 hover:bg-tennis-green-50 border border-gray-100'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="md:col-span-1 glass-panel p-6 shadow-sm flex flex-col gap-4">
                    <label className="text-sm font-bold text-gray-600 flex items-center gap-2">
                        <Search size={16} /> 選手名・所属
                    </label>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="検索..."
                            className="w-full pl-12 pr-4 py-3 bg-white/50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-tennis-green-500 transition-all font-medium"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="glass-panel shadow-sm border border-tennis-green-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Users size={20} className="text-tennis-green-600" />
                        {selectedCategory} 選手リスト
                    </h3>
                    <span className="text-sm font-bold text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-100">
                        {filteredData.length} 名表示中
                    </span>
                </div>

                <div className="overflow-x-auto min-h-[400px]">
                    {loading ? (
                        <div className="h-[400px] flex flex-col items-center justify-center text-tennis-green-600">
                            <Loader2 className="w-12 h-12 animate-spin mb-4" />
                            <p className="font-bold animate-pulse">データを読み込み中...</p>
                        </div>
                    ) : filteredData.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-gray-100">
                                <tr>
                                    <th className="px-3 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center min-w-[50px]">順位</th>
                                    <th className="px-3 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest min-w-[140px]">選手名 / 所属</th>
                                    <th className="px-3 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right min-w-[80px]">ポイント</th>
                                    <th className="px-3 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center min-w-[80px]">登録</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredData.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-tennis-green-50/50 transition-colors group">
                                        <td className="px-3 py-5 text-center">
                                            <span className="text-xl sm:text-2xl font-black text-tennis-green-600 whitespace-nowrap">
                                                {item.ranking?.rank}
                                            </span>
                                        </td>
                                        <td className="px-3 py-5 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded shrink-0">
                                                    {item.player.category}
                                                </span>
                                                <p className="font-bold text-gray-800 text-base sm:text-lg truncate">{item.player.full_name}</p>
                                            </div>
                                            <p className="text-[10px] text-gray-400 font-bold mt-0.5 truncate">{item.player.team || '所属なし'}</p>
                                        </td>
                                        <td className="px-3 py-5 text-right">
                                            <div className="flex items-center justify-end whitespace-nowrap">
                                                <span className="font-bold text-tennis-green-700 text-base sm:text-lg">
                                                    {item.ranking?.rank === 0 ? '-' : item.player.ranking_point.toLocaleString()}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-bold ml-1 italic shrink-0">pt</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-5">
                                            <div className="flex items-center justify-center">
                                                <button
                                                    onClick={() => handleAction(item.player, 'opponent')}
                                                    disabled={actionLoading?.startsWith(item.player.player_id)}
                                                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-[11px] font-black shadow-sm ${
                                                        watchedIds.has(item.player.player_id)
                                                        ? 'bg-amber-500 text-white'
                                                        : 'bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white'
                                                    }`}
                                                >
                                                    {watchedIds.has(item.player.player_id) ? '解除' : '対戦相手'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="h-[400px] flex flex-col items-center justify-center text-center p-12">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                                <AlertCircle size={40} className="text-gray-200" />
                            </div>
                            <h4 className="text-xl font-bold text-gray-700 mb-2">データが見つかりません</h4>
                            <p className="text-gray-400 max-w-sm">
                                指定されたカテゴリーまたは検索条件に一致する選手は見つかりませんでした。
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
