import { useState, useEffect } from 'react';
import { Database, Calendar } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import type { Player, CategoryRanking } from '../types/database';
import { RankingFilters } from './ranking/RankingFilters';
import { RankingTable } from './ranking/RankingTable';
import { PlayerChartModal } from './ranking/PlayerChartModal';

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
    const [selectedPlayerChart, setSelectedPlayerChart] = useState<Player | null>(null);


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
                const uniqueGenders = Array.from(new Set(
                    data.map(g => (g.gender || '').trim())
                ))
                    .filter(g => g && g.length > 0)
                    .sort();
                setAvailableGenders(uniqueGenders);
            }
        };

        if (initialGender && initialGender.trim()) {
            setSelectedGender(initialGender.trim());
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

            const { data: rankings } = await supabase
                .from('category_rankings')
                .select('*')
                .eq('category', selectedCategory)
                .order('year_month', { ascending: false })
                .order('rank', { ascending: true })
                .limit(200);

            if (rankings && rankings.length > 0) {
                setYearMonth(rankings[0].year_month);

                const playerIds = rankings.map(r => r.player_id);
                const { data: players } = await supabase
                    .from('players')
                    .select('*')
                    .in('player_id', playerIds);

                if (players) {
                    const combined = rankings.map(r => ({
                        ranking: r,
                        player: players.find(p => p.player_id === r.player_id) as Player
                    })).filter(item => item.player);

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
                    <h1 className="text-2xl font-bold font-display text-tennis-green-900 flex items-center tracking-tight">
                        <Database className="mr-3 h-6 w-6 text-tennis-green-600" />
                        ランキング
                    </h1>
                    <p className="text-tennis-green-600 font-bold mt-1">
                        愛知県の選手情報をカテゴリー別にランキング順で閲覧できます。
                    </p>
                </div>
                <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-tennis-green-100 shrink-0">
                    <div className="flex items-center px-3 py-1.5 sm:px-4 sm:py-2 text-tennis-green-600 bg-tennis-green-50 rounded-xl whitespace-nowrap">
                        <Calendar size={14} className="mr-2 sm:size-[18px]" />
                        <span className="text-[10px] sm:text-sm font-bold">最新: {yearMonth}</span>
                    </div>
                </div>
            </header>

            <RankingFilters 
                categories={categories}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                availableGenders={availableGenders}
                selectedGender={selectedGender}
                onGenderChange={setSelectedGender}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
            />

            <RankingTable 
                loading={loading}
                data={filteredData}
                selectedCategory={selectedCategory}
                watchedIds={watchedIds}
                actionLoading={actionLoading}
                onAction={handleAction}
                onPlayerClick={setSelectedPlayerChart}
            />

            {selectedPlayerChart && (
                <PlayerChartModal 
                    player={selectedPlayerChart} 
                    onClose={() => setSelectedPlayerChart(null)} 
                />
            )}
        </div>
    );
}

