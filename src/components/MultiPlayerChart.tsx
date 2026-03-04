import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import type { Player, PlayerRankingHistory, CategoryRanking } from '../types/database';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Loader2, TrendingUp, Presentation } from 'lucide-react';

// Generates a consistent color for a given player ID
const getColor = (_id: string, index: number) => {
    const colors = [
        '#2C8F6A', '#1F6F52', '#E11D48', '#2563EB', '#D97706',
        '#7C3AED', '#059669', '#DB2777', '#0284C7', '#CA8A04',
        '#9333EA', '#16A34A', '#BE123C', '#1D4ED8', '#B45309',
        '#6D28D9', '#047857', '#9D174D', '#0369A1', '#A16207'
    ];
    return colors[index % colors.length];
};

export default function MultiPlayerChart() {
    const [loading, setLoading] = useState(true);
    const [watchedPlayers, setWatchedPlayers] = useState<Player[]>([]);
    const [rankingData, setRankingData] = useState<PlayerRankingHistory[]>([]);
    const [categoryData, setCategoryData] = useState<CategoryRanking[]>([]);
    const [activeTab, setActiveTab] = useState<'points' | 'category'>('points');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // 1. Get watched player IDs
            const { data: watchedIds } = await supabase
                .from('user_watched_players')
                .select('player_id')
                .eq('user_id', session.user.id);

            if (!watchedIds || watchedIds.length === 0) {
                setWatchedPlayers([]);
                setLoading(false);
                return;
            }

            const pIds = watchedIds.map(w => w.player_id);

            // 2. Fetch Player Details
            const { data: players } = await supabase
                .from('players')
                .select('*')
                .in('player_id', pIds);

            if (players) setWatchedPlayers(players as Player[]);

            // 3. Fetch History for those players
            // For thousands of rows, this should be paginated or date-limited, but we fetch all for now
            const { data: history } = await supabase
                .from('player_ranking_history')
                .select('*')
                .in('player_id', pIds)
                .order('year_month', { ascending: true });

            if (history) setRankingData(history as PlayerRankingHistory[]);

            // 4. Fetch Category Rankings
            const { data: category } = await supabase
                .from('category_rankings')
                .select('*')
                .in('player_id', pIds)
                .order('year_month', { ascending: true });

            if (category) setCategoryData(category as CategoryRanking[]);

            setLoading(false);
        };

        fetchData();

        // Set up a real-time subscription for changes to the user's watched list
        const channel = supabase.channel('custom-all-channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'user_watched_players' },
                () => {
                    fetchData(); // re-fetch on change
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Transform 'player_ranking_history' into Rechart's expected format (Series of YearMonths)
    const chartDataPoints = useMemo(() => {
        const map = new Map<string, any>(); // key = yearMonth, value = { yearMonth, [playerId]: points }

        rankingData.forEach(item => {
            const existing = map.get(item.year_month) || { yearMonth: item.year_month };
            existing[item.player_id] = item.points_value;
            map.set(item.year_month, existing);
        });

        return Array.from(map.values()).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    }, [rankingData]);

    // Transfrom 'category_rankings'
    const chartDataCategory = useMemo(() => {
        const map = new Map<string, any>();

        categoryData.forEach(item => {
            // Combining yearMonth and category as X-Axis or just yearMonth grouped by category.
            // For simplicity, we assume one category type is primarily viewed, or we just plot Raw Rank
            const xKey = `${item.year_month} (${item.category})`;
            const existing = map.get(xKey) || { label: xKey };
            existing[item.player_id] = item.rank;
            map.set(xKey, existing);
        });

        return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [categoryData]);

    if (loading) {
        return (
            <div className="glass-panel p-6 shadow-sm min-h-[400px] flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-tennis-green-500 animate-spin" />
            </div>
        );
    }

    if (watchedPlayers.length === 0) {
        return (
            <div className="glass-panel p-6 shadow-sm min-h-[400px] flex items-center justify-center border-dashed border-2 border-tennis-green-200">
                <div className="text-center text-gray-500">
                    <Presentation className="w-12 h-12 text-tennis-green-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-800">No Players Watched</h3>
                    <p className="mt-1 text-sm">Use the search below to add players to your graph.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-panel p-6 shadow-sm mt-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center">
                        <TrendingUp className="mr-2 h-5 w-5 text-tennis-green-600" />
                        Performance Comparison ({watchedPlayers.length}/20 Players)
                    </h3>
                </div>
                <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'points' ? 'bg-white shadow text-tennis-green-700' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('points')}
                    >
                        Points History
                    </button>
                    <button
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'category' ? 'bg-white shadow text-tennis-green-700' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('category')}
                    >
                        Category Ranking
                    </button>
                </div>
            </div>

            <div className="h-[400px] w-full">
                {activeTab === 'points' && chartDataPoints.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartDataPoints} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                            <XAxis dataKey="yearMonth" tick={{ fill: '#6b7280', fontSize: 12 }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                            {watchedPlayers.map((player, idx) => (
                                <Line
                                    key={player.player_id}
                                    type="monotone"
                                    dataKey={player.player_id}
                                    name={player.full_name || player.last_name || player.player_id}
                                    stroke={getColor(player.player_id, idx)}
                                    strokeWidth={2}
                                    dot={{ r: 3, strokeWidth: 2 }}
                                    activeDot={{ r: 6 }}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                )}

                {activeTab === 'category' && chartDataCategory.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                        {/* Note: reversed Y-axis is standard for Ranks (1 is highest) */}
                        <LineChart data={chartDataCategory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} tickLine={false} axisLine={false} />
                            <YAxis reversed tick={{ fill: '#6b7280', fontSize: 12 }} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                            {watchedPlayers.map((player, idx) => (
                                <Line
                                    key={player.player_id}
                                    type="monotone"
                                    dataKey={player.player_id}
                                    name={player.full_name || player.last_name || player.player_id}
                                    stroke={getColor(player.player_id, idx)}
                                    strokeWidth={2}
                                    dot={{ r: 3, strokeWidth: 2 }}
                                    activeDot={{ r: 6 }}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                )}

                {((activeTab === 'points' && chartDataPoints.length === 0) ||
                    (activeTab === 'category' && chartDataCategory.length === 0)) && (
                        <div className="h-full flex items-center justify-center text-gray-400">
                            No history data available for the selected players.
                        </div>
                    )}
            </div>
        </div>
    );
}
