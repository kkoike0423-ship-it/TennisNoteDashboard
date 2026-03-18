import React from 'react';
import { Users, AlertCircle, Loader2 } from 'lucide-react';
import { type Player, type CategoryRanking } from '../../types/database';

interface DisplayData {
  player: Player;
  ranking: CategoryRanking | null;
}

interface RankingTableProps {
  loading: boolean;
  data: DisplayData[];
  selectedCategory: string;
  watchedIds: Set<string>;
  actionLoading: string | null;
  onAction: (player: Player, type: 'managed' | 'opponent') => void;
  onPlayerClick?: (player: Player) => void;
}

export const RankingTable: React.FC<RankingTableProps> = ({
  loading,
  data,
  selectedCategory,
  watchedIds,
  actionLoading,
  onAction,
  onPlayerClick,
}) => {
  return (
    <div className="glass-panel shadow-sm border border-tennis-green-100 overflow-hidden">
      <div className="p-6 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Users size={20} className="text-tennis-green-600" />
          {selectedCategory} 選手リスト
        </h3>
        <span className="text-sm font-bold text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-100">
          {data.length} 名表示中
        </span>
      </div>

      <div className="overflow-x-auto min-h-[400px]">
        {loading ? (
          <div className="h-[400px] flex flex-col items-center justify-center text-tennis-green-600">
            <Loader2 className="w-12 h-12 animate-spin mb-4" />
            <p className="font-bold animate-pulse">データを読み込み中...</p>
          </div>
        ) : data.length > 0 ? (
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
              {data.map((item, idx) => (
                <tr 
                  key={`${item.player.player_id}-${idx}`} 
                  onClick={() => onPlayerClick?.(item.player)}
                  className="hover:bg-tennis-green-50/50 transition-colors group cursor-pointer active:bg-tennis-green-100"
                >
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
                  <td className="px-3 py-5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAction(item.player, 'opponent');
                        }}
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
  );
};
