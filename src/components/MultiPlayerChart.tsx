import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import type { Player, CategoryRanking } from '../types/database';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList
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
}

export default function MultiPlayerChart({ playerType, title, activeManagedPlayerId }: MultiPlayerChartProps) {
    const [loading, setLoading] = useState(true);
    const [watchedPlayers, setWatchedPlayers] = useState<Player[]>([]);
    const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
    const [categoryData, setCategoryData] = useState<CategoryRanking[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);
    const [hiddenPlayerIds, setHiddenPlayerIds] = useState<Set<string>>(new Set());

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

            if (players) {
                setWatchedPlayers(players as Player[]);
                // Initialize all players as selected when loaded
                setSelectedPlayers(new Set((players as Player[]).map(p => p.player_id)));
            }

            // 3. Fetch Category Rankings (Include Managed Player for matching)
            const queryIds = [...pIds];
            if (activeManagedPlayerId && !queryIds.includes(activeManagedPlayerId)) {
                queryIds.push(activeManagedPlayerId);
            }

            const { data: category } = await supabase
                .from('category_rankings')
                .select('*')
                .in('player_id', queryIds)
                .order('year_month', { ascending: true });

            if (category) {
                setCategoryData(category as CategoryRanking[]);
                const uniqueCats = Array.from(new Set((category as CategoryRanking[]).map(c => c.category))).sort();
                setAvailableCategories(uniqueCats);
            }

            // Set initial selected category
            if (activeManagedPlayerId) {
                const { data: player } = await supabase
                    .from('players')
                    .select('category')
                    .eq('player_id', activeManagedPlayerId)
                    .single();
                if (player && !selectedCategory) {
                    setSelectedCategory(player.category);
                }
            }

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

        const handleVisibilityUpdate = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.playerType === playerType) {
                setHiddenPlayerIds(new Set(customEvent.detail.hiddenIds));
            }
        };
        window.addEventListener('player-visibility-changed', handleVisibilityUpdate);

        return () => {
            window.removeEventListener('watched-players-changed', handleUpdate);
            window.removeEventListener('player-visibility-changed', handleVisibilityUpdate);
        };
    }, [playerType, activeManagedPlayerId]);

    const togglePlayerSelection = (playerId: string) => {
        setSelectedPlayers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(playerId)) {
                newSet.delete(playerId);
            } else {
                newSet.add(playerId);
            }
            return newSet;
        });
    };



    // Transform 'category_rankings' to a format suitable for Recharts.
    // Each month will have one value per player_id, which is the rank for the selected category.
    const chartDataCategory = useMemo(() => {
        const map = new Map<string, any>();

        categoryData.forEach(item => {
            if (item.category !== selectedCategory) return;

            const xKey = item.year_month;
            const existing = map.get(xKey) || { label: xKey };

            existing[item.player_id] = item.rank;
            map.set(xKey, existing);
        });

        return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [categoryData, selectedCategory]);

    const playerLines = useMemo(() => {
        const playerIds = new Set<string>();
        categoryData.forEach(item => {
            if (selectedPlayers.has(item.player_id) && watchedPlayers.some(p => p.player_id === item.player_id)) {
                if (!hiddenPlayerIds.has(item.player_id)) {
                    playerIds.add(item.player_id);
                }
            }
        });

        const idsArray = Array.from(playerIds);

        // Sort by latest available rank (smaller rank = higher priority/higher in graph)
        return idsArray.sort((a, b) => {
            // Find the most recent month where player A has a rank
            const lastDataA = [...chartDataCategory].reverse().find(d => d[a] !== undefined);
            const lastDataB = [...chartDataCategory].reverse().find(d => d[b] !== undefined);

            const rankA = lastDataA ? lastDataA[a] : 999999;
            const rankB = lastDataB ? lastDataB[b] : 999999;

            // If ranks are equal, sort by ID to be stable
            if (rankA === rankB) return a.localeCompare(b);
            return rankA - rankB;
        });
    }, [categoryData, watchedPlayers, hiddenPlayerIds, chartDataCategory]);

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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center">
                        <TrendingUp className="mr-2 h-5 w-5 text-tennis-green-600" />
                        {title} {playerType === 'opponent' && `(${watchedPlayers.length}/10)`}
                    </h3>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-sm font-medium text-gray-600 whitespace-nowrap">カテゴリー:</span>
                    <select
                        className="flex-1 sm:flex-none bg-white border border-tennis-green-200 text-gray-700 py-1.5 px-3 rounded-lg outline-none focus:ring-2 focus:ring-tennis-green-500 text-sm"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                        {availableCategories.length === 0 ? (
                            <option value="">データなし</option>
                        ) : (
                            availableCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))
                        )}
                    </select>
                </div>
            </div>

            {/* Player Selection Checkboxes */}
            <div className="flex flex-wrap gap-3 mb-6">
                {watchedPlayers.map((player, idx) => {
                    const color = getColor(player.player_id, idx);
                    const isSelected = selectedPlayers.has(player.player_id);
                    const name = player.full_name || player.last_name || "Unknown";

                    return (
                        <label
                            key={player.player_id}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm cursor-pointer transition-all duration-200 select-none ${isSelected
                                    ? 'bg-white shadow-sm border-gray-200'
                                    : 'bg-gray-50 border-transparent text-gray-400 opacity-70 hover:opacity-100'
                                }`}
                        >
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={isSelected}
                                onChange={() => togglePlayerSelection(player.player_id)}
                            />
                            <div
                                className="w-3 h-3 rounded-full flex-shrink-0 transition-transform duration-200"
                                style={{
                                    backgroundColor: isSelected ? color : '#d1d5db',
                                    transform: isSelected ? 'scale(1)' : 'scale(0.8)'
                                }}
                            />
                            <span className={`font-medium ${isSelected ? 'text-gray-700' : 'text-gray-500'}`}>
                                {name}
                            </span>
                        </label>
                    );
                })}
            </div>

            <div className={`w-full ${playerType === 'managed' ? 'h-[300px] md:h-[400px]' : 'h-[500px] md:h-[700px]'}`}>
                {chartDataCategory.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                        {/* Note: reversed Y-axis is standard for Ranks (1 is highest) */}
                        <LineChart data={chartDataCategory} margin={{ top: 5, right: 140, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: '#6b7280', fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val) => {
                                    if (typeof val === 'string' && val.length === 6) {
                                        return `${val.slice(2, 4)}/${val.slice(4)}`;
                                    }
                                    return val;
                                }}
                            />
                            <YAxis reversed tick={{ fill: '#6b7280', fontSize: 12 }} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                            <Tooltip
                                content={(props: any) => {
                                    const { active, payload, label } = props;
                                    if (active && payload && payload.length) {
                                        // Sort by rank value (asc)
                                        const sortedPayload = [...payload].sort((a, b) => a.value - b.value);

                                        return (
                                            <div className="bg-white/95 backdrop-blur-sm p-3 rounded-xl border border-tennis-green-100 shadow-lg animate-in fade-in zoom-in duration-200">
                                                <p className="text-[10px] font-bold text-gray-400 mb-2 tracking-wider">
                                                    {label?.slice(0, 4)}年{label?.slice(4)}月
                                                </p>
                                                <div className="space-y-1.5">
                                                    {sortedPayload.map((entry: any, idx: number) => {
                                                        const p = watchedPlayers.find(wp => wp.player_id === entry.dataKey);
                                                        const points = p?.ranking_point || 0;
                                                        return (
                                                            <div key={idx} className="flex items-center justify-between gap-4">
                                                                <div className="flex items-center gap-2">
                                                                    <div
                                                                        className="w-2 h-2 rounded-full"
                                                                        style={{ backgroundColor: entry.color }}
                                                                    />
                                                                    <span className="text-xs font-bold text-gray-700">
                                                                        {entry.name}
                                                                    </span>
                                                                </div>
                                                                <span className="text-xs font-black text-tennis-green-600">
                                                                    {entry.value}位 <span className="text-[10px] font-normal text-gray-400">/ {points.toLocaleString()}pt</span>
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                            {playerLines.map((playerId) => {
                                const player = watchedPlayers.find(p => p.player_id === playerId);
                                if (!player) return null;

                                const playerIdx = playerLines.indexOf(playerId);
                                const baseColor = getColor(player.player_id, playerIdx);

                                return (
                                    <Line
                                        key={playerId}
                                        type="monotone"
                                        dataKey={playerId}
                                        name={player.full_name || player.last_name || playerId}
                                        stroke={baseColor}
                                        strokeWidth={3}
                                        dot={{ r: 4, strokeWidth: 2 }}
                                        activeDot={{ r: 6 }}
                                        connectNulls
                                    >
                                        <LabelList
                                            dataKey={playerId}
                                            position="right"
                                            content={(props: any) => {
                                                const { x, y, index, value } = props;
                                                if (value === undefined || value === null) return null;

                                                // Only show label for the last available data point for this specific player
                                                const isLastPoint = !chartDataCategory.slice(index + 1).some(d => d[playerId] !== undefined);
                                                if (!isLastPoint) return null;

                                                // Extract surname (first part of full_name or last_name)
                                                const fullName = player.full_name || player.last_name || "";
                                                const surname = fullName.split(' ')[0] || fullName.split('　')[0] || fullName;

                                                // Get the player's current points
                                                const points = player.ranking_point || 0;

                                                return (
                                                    <text
                                                        x={x + 10}
                                                        y={y + 4}
                                                        fill={baseColor}
                                                        fontSize={12}
                                                        fontWeight="bold"
                                                        className="drop-shadow-sm"
                                                    >
                                                        {surname}
                                                        <tspan dx={6} fill="#6b7280" fontSize={10} fontWeight="normal">
                                                            {value}位 / {points.toLocaleString()}pt
                                                        </tspan>
                                                    </text>
                                                );
                                            }}
                                        />
                                    </Line>
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
