import React, { useState, useEffect } from 'react';
import { X, TrendingUp, BarChart, Loader2 } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { type Player, type CategoryRanking, type PlayerRankingHistory } from '../../types/database';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';

interface PlayerChartModalProps {
  player: Player;
  onClose: () => void;
}

export const PlayerChartModal: React.FC<PlayerChartModalProps> = ({ player, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [rankingHistory, setRankingHistory] = useState<CategoryRanking[]>([]);
  const [pointHistory, setPointHistory] = useState<PlayerRankingHistory[]>([]);

  const getPointValue = (history?: PlayerRankingHistory) => {
    if (!history) return null;

    const raw = history.points_raw as unknown;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      const parsed = Number.parseFloat(raw);
      if (Number.isFinite(parsed)) return parsed;
    }

    const normalized = history.points_value as unknown;
    if (typeof normalized === 'number' && Number.isFinite(normalized)) return normalized;
    if (typeof normalized === 'string') {
      const parsed = Number.parseFloat(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }

    return null;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch ranking history for the player's current category
        const { data: rankData } = await supabase
          .from('category_rankings')
          .select('*')
          .eq('player_id', player.player_id)
          .eq('category', player.category)
          .order('year_month', { ascending: true });

        // Fetch point history
        const { data: pointData } = await supabase
          .from('player_ranking_history')
          .select('*')
          .eq('player_id', player.player_id)
          .order('year_month', { ascending: true });

        if (rankData) setRankingHistory(rankData);
        if (pointData) setPointHistory(pointData);
      } catch (err) {
        console.error('Error fetching player history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [player.player_id, player.category]);

  // Mirror the Android app: use the selected category's ranking months and join
  // point history by player + year_month.
  const chartData = React.useMemo(() => {
    const pointHistoryByMonth = new Map(
      pointHistory.map(history => [history.year_month, history])
    );

    return rankingHistory.map(ranking => {
      const point = pointHistoryByMonth.get(ranking.year_month);
      return {
        month: ranking.year_month,
        rank: ranking.rank ?? null,
        points: getPointValue(point)
      };
    }).filter(d => d.rank !== null || d.points !== null);
  }, [rankingHistory, pointHistory]);

  const formatMonth = (val: string) => {
    if (typeof val === 'string' && val.length === 6) return `${val.slice(2, 4)}/${val.slice(4)}`;
    return val;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300 px-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2rem] shadow-2xl relative animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-tennis-green-100 flex items-center justify-center text-tennis-green-700 font-black text-xl shadow-inner">
              {player.last_name ? player.last_name[0] : (player.full_name ? player.full_name[0] : '?')}
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 leading-tight">{player.full_name}</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{player.team} | {player.category}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all active:scale-90"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-tennis-green-600">
              <Loader2 className="w-10 h-10 animate-spin" />
              <p className="font-bold text-xs uppercase tracking-widest animate-pulse">Loading Analytics...</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="py-20 text-center text-gray-400 font-bold">
              履歴データが見つかりませんでした。
            </div>
          ) : (
            <>
              {/* Ranking Chart */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <TrendingUp size={16} className="text-tennis-green-600" /> Ranking History ({player.category})
                </h4>
                <div className="h-[250px] w-full bg-gray-50/50 rounded-3xl p-4 border border-gray-100">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="month" 
                        tickFormatter={formatMonth} 
                        tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis 
                        reversed 
                        tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}}
                        axisLine={false}
                        tickLine={false}
                        width={30}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ fontWeight: 'black', fontSize: '10px', color: '#10b981' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="rank" 
                        stroke="#10b981" 
                        strokeWidth={4} 
                        dot={{ r: 4, fill: '#fff', stroke: '#10b981', strokeWidth: 2 }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Points Chart */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <BarChart size={16} className="text-blue-600" /> Points Trend
                </h4>
                <div className="h-[250px] w-full bg-gray-50/50 rounded-3xl p-4 border border-gray-100">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="month" 
                        tickFormatter={formatMonth} 
                        tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis 
                        tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ fontWeight: 'black', fontSize: '10px', color: '#3b82f6' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="points" 
                        stroke="#3b82f6" 
                        fillOpacity={1} 
                        fill="url(#colorPoints)" 
                        strokeWidth={4}
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          <div className="pt-4 flex justify-center">
            <button 
              onClick={onClose}
              className="px-8 py-3 bg-gray-900 text-white rounded-2xl text-xs font-black tracking-widest uppercase hover:bg-tennis-green-600 transition-all shadow-xl active:scale-95"
            >
              閉じる / Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
