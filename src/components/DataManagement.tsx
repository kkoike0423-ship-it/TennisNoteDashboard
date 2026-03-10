import { useState, useEffect } from 'react';
import { Search, Database, Users, Calendar, AlertCircle, Loader2, Table } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import type { Player, CategoryRanking } from '../types/database';

interface DisplayData {
    player: Player;
    ranking: CategoryRanking | null;
}

export default function DataManagement() {
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [displayData, setDisplayData] = useState<DisplayData[]>([]);
    const [yearMonth, setYearMonth] = useState<string>('');

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
                    setSelectedCategory('U11'); // Default to U11 or first available
                }
            }
        };
        fetchCategories();
    }, []);

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

    const filteredData = displayData.filter(item =>
        item.player.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.player.team?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 container mx-auto px-4 py-8 max-w-7xl animate-fade-in">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-tennis-green-100 pb-6">
                <div>
                    <h1 className="text-3xl font-bold font-display text-tennis-green-900 flex items-center">
                        <Database className="mr-3 h-8 w-8 text-tennis-green-600" />
                        インポートデータ管理
                    </h1>
                    <p className="text-tennis-green-600 mt-1">
                        CSVからインポートされた選手データとランキングをカテゴリー別に閲覧します。
                    </p>
                </div>
                <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-tennis-green-100">
                    <div className="flex items-center px-4 py-2 text-tennis-green-600 bg-tennis-green-50 rounded-xl">
                        <Calendar size={18} className="mr-2" />
                        <span className="text-sm font-bold">最新データ: {yearMonth}</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 shadow-sm flex flex-col gap-4">
                    <label className="text-sm font-bold text-gray-600 flex items-center gap-2">
                        <Table size={16} /> カテゴリー選択
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

                <div className="md:col-span-2 glass-panel p-6 shadow-sm flex flex-col gap-4">
                    <label className="text-sm font-bold text-gray-600 flex items-center gap-2">
                        <Search size={16} /> 選手名・所属検索
                    </label>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="名前またはチーム名を入力..."
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
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">順位</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">選手名 / ID</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">所属チーム</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">ポイント</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">基本カテゴリ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredData.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-tennis-green-50/50 transition-colors group">
                                        <td className="px-6 py-5 text-center">
                                            <span className="text-2xl font-black text-tennis-green-600">
                                                {item.ranking?.rank}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="font-bold text-gray-800 text-lg">{item.player.full_name}</p>
                                            <p className="text-[10px] text-gray-400 font-mono mt-1">{item.player.player_id}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-gray-600 font-medium">{item.player.team || '-'}</span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <span className="font-bold text-tennis-green-700 text-lg">
                                                {item.ranking?.rank === 0 ? '-' : item.player.ranking_point.toLocaleString()}
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-bold ml-1 italic">pt</span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${item.player.category === selectedCategory
                                                    ? 'bg-tennis-green-50 text-tennis-green-700 border-tennis-green-100'
                                                    : 'bg-orange-50 text-orange-700 border-orange-100'
                                                }`}>
                                                {item.player.category}
                                            </span>
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
