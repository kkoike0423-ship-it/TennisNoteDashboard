import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import type { Player, CategoryRanking } from '../types/database';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Loader2, TrendingUp, Presentation } from 'lucide-react';

// Generates a consistent color for a given player ID
const getColor = (_id: string, index: number) => {
    const colors = [
        '#2563EB', // Blue
        '#E11D48', // Rose
        '#D97706', // Orange
        '#7C3AED', // Violet
        '#0891B2', // Cyan
        '#DB2777', // Pink
        '#CA8A04', // Amber
        '#9333EA', // Purple
        '#059669', // Emerald (Green alternative)
        '#BE123C', // Crimson
        '#4F46E5', // Indigo
        '#B45309', // Brown
        '#1D4ED8', // Royal Blue
        '#047857', // Dark Green
        '#6D28D9', // Deep Purple
        '#9D174D', // Maroon
        '#0369A1', // Sky Blue
        '#A16207', // Dark Gold
        '#16A34A', // Green
        '#0284C7'  // Light Blue
    ];
    return colors[index % colors.length];
};

interface MultiPlayerChartProps {
    playerType: 'managed' | 'opponent';
    title: string;
    activeManagedPlayerId: string | null;
    categoryScope?: 'current' | 'next'; // New prop
}

export default function MultiPlayerChart({ playerType, title, activeManagedPlayerId, categoryScope = 'current' }: MultiPlayerChartProps) {
    const [loading, setLoading] = useState(true);
    const [watchedPlayers, setWatchedPlayers] = useState<Player[]>([]);
    const [categoryData, setCategoryData] = useState<CategoryRanking[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // 1. Get watched player IDs
            let dbQuery = supabase
                .from('user_watched_players')
                .select('player_id')
                .eq('user_id', session.user.id)
                .eq('player_type', playerType);

            if (playerType === 'opponent') {
                if (!activeManagedPlayerId) {
                    setWatchedPlayers([]);
                    setLoading(false);
                    return;
                }
                dbQuery = dbQuery.eq('target_managed_player_id', activeManagedPlayerId);
            } else if (playerType === 'managed') {
                // For managed section, only show the currently active one in the chart 
                // (Requirement: if 1 is selected, show that 1)
                if (activeManagedPlayerId) {
                    dbQuery = dbQuery.eq('player_id', activeManagedPlayerId);
                }
            }

            const { data: watchedIds } = await dbQuery;

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

            // 3. Fetch Category Rankings
            const { data: category } = await supabase
                .from('category_rankings')
                .select('*')
                .in('player_id', pIds)
                .order('year_month', { ascending: true });

            if (category) setCategoryData(category as CategoryRanking[]);

            setLoading(false);
        };

        fetchData();

        const handleUpdate = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.playerType === playerType) {
                fetchData();
            }
        };

        window.addEventListener('watched-players-changed', handleUpdate);

        return () => {
            window.removeEventListener('watched-players-changed', handleUpdate);
        };
    }, [playerType, activeManagedPlayerId]);

    // Transfrom 'category_rankings'
    const chartDataCategory = useMemo(() => {
        const map = new Map<string, any>();

        categoryData.forEach(item => {
            const xKey = item.year_month;
            const existing = map.get(xKey) || { label: xKey };
            existing[`${item.player_id}_${item.category}`] = item.rank;
            map.set(xKey, existing);
        });

        return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [categoryData]);

    // Helper function to get the next category logically
    const getNextCategory = (cat: string) => {
        if (!cat) return null;
        const uMatch = cat.match(/U(\d+)/i);
        if (uMatch) {
            const num = parseInt(uMatch[1], 10);
            if (num < 18) {
                // Common steps in junior tennis: U10 -> U11 -> U12 -> U13 -> U14 -> U15 -> U16 -> U18
                if (num === 16) return 'U18';
                return `U${num + 1}`;
            }
        }
        return null;
    };

    // For 'managed' view, the primary category is the active player's category
    // For 'opponent' view, we need to find the categories of the activeManagedPlayerId
    const [managedCategories, setManagedCategories] = useState<string[]>([]);

    useEffect(() => {
        const fetchManagedCategories = async () => {
            if (!activeManagedPlayerId) {
                setManagedCategories([]);
                return;
            }

            // Get all categories this managed player has ranking data for
            const { data } = await supabase
                .from('category_rankings')
                .select('category')
                .eq('player_id', activeManagedPlayerId);

            if (data && data.length > 0) {
                const uniqueCats = Array.from(new Set(data.map(d => d.category)));
                setManagedCategories(uniqueCats);
            } else {
                // Fallback to current category if no ranking history
                const { data: player } = await supabase
                    .from('players')
                    .select('category')
                    .eq('player_id', activeManagedPlayerId)
                    .single();
                if (player) setManagedCategories([player.category]);
            }
        };
        fetchManagedCategories();
    }, [activeManagedPlayerId]);

    // Unique category lines to draw
    const categoryLines = useMemo(() => {
        const linesMap = new Map<string, { playerId: string; category: string }>();

        categoryData.forEach(item => {
            const player = watchedPlayers.find(p => p.player_id === item.player_id);
            if (!player) return;

            const currentCat = player.category;
            const nextCat = getNextCategory(currentCat);

            let shouldInclude = false;

            if (playerType === 'managed') {
                // ■ 管理選手グラフ: 本人のカテゴリ ＋ 本人の次のカテゴリー
                if (item.category === currentCat || item.category === nextCat) {
                    shouldInclude = true;
                }
            } else {
                // ■ 対戦相手グラフ: 
                // 管理選手が各月においてどのカテゴリーにいたかを調べ、その「現在のカテゴリ」または「1つ上のカテゴリ」に一致するか判定
                const managedRankingAtThisTime = categoryData.find(
                    cat => cat.player_id === activeManagedPlayerId && cat.year_month === item.year_month
                );

                if (managedRankingAtThisTime) {
                    const targetCategory = categoryScope === 'current'
                        ? managedRankingAtThisTime.category
                        : getNextCategory(managedRankingAtThisTime.category);

                    if (item.category === targetCategory) {
                        shouldInclude = true;
                    }
                } else if (managedCategories.includes(item.category)) {
                    // 履歴がない月は、現在のカテゴリーリストに含まれていれば（フォールバック）
                    const latestManagedCat = managedCategories[0];
                    const targetCategory = categoryScope === 'current'
                        ? latestManagedCat
                        : getNextCategory(latestManagedCat);

                    if (item.category === targetCategory) {
                        shouldInclude = true;
                    }
                }
            }

            if (shouldInclude) {
                const key = `${item.player_id}_${item.category}`;
                if (!linesMap.has(key)) {
                    linesMap.set(key, { playerId: item.player_id, category: item.category });
                }
            }
        });
        return Array.from(linesMap.values());
    }, [categoryData, watchedPlayers, playerType, managedCategories, categoryScope, activeManagedPlayerId]);

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
                        {title} ({watchedPlayers.length}/10)
                    </h3>
                </div>
            </div>

            <div className="h-[300px] md:h-[400px] w-full">
                {chartDataCategory.length > 0 && (
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
                            {categoryLines.map((lineDef) => {
                                const player = watchedPlayers.find(p => p.player_id === lineDef.playerId);
                                if (!player) return null;

                                const playerIdx = watchedPlayers.findIndex(p => p.player_id === lineDef.playerId);

                                // Color logic based on requirements
                                let isHighlighted = false;
                                if (playerType === 'managed') {
                                    // 管理選手: 本人のカテゴリが強調される
                                    isHighlighted = player.category === lineDef.category;
                                } else {
                                    // 対戦相手: その月そのカテゴリーが「ターゲット」なら強調
                                    // (ここは既に categoryLines でフィルタリングされているので基本 true になるはずだが、現在のカテゴリを優先して色付け)
                                    isHighlighted = true;
                                }

                                const baseColor = getColor(player.player_id, playerIdx);

                                return (
                                    <Line
                                        key={`${lineDef.playerId}_${lineDef.category}`}
                                        type="monotone"
                                        dataKey={`${lineDef.playerId}_${lineDef.category}`}
                                        name={`${player.full_name || player.last_name || player.player_id} (${lineDef.category})`}
                                        stroke={isHighlighted ? baseColor : '#d1d5db'}
                                        strokeDasharray={isHighlighted ? undefined : "5 5"}
                                        strokeWidth={isHighlighted ? 3 : 2}
                                        dot={{ r: isHighlighted ? 4 : 2, strokeWidth: 2 }}
                                        activeDot={{ r: 6 }}
                                        connectNulls
                                    />
                                );
                            })}
                        </LineChart>
                    </ResponsiveContainer>
                )}

                {chartDataCategory.length === 0 && (
                    <div className="h-full flex items-center justify-center text-gray-400">
                        No ranking data available for the selected players.
                    </div>
                )}
            </div>
        </div>
    );
}
