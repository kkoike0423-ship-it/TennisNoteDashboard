import React from 'react';
import { ChevronDown, ChevronUp, Edit2, Trash2, Plus } from 'lucide-react';
import { type Tournament, type Game, type Player } from '../../types/database';

interface GameWithOpponent extends Game {
  opponent_info?: Player | null;
  opponent_rank?: number | null;
  opponent1_info?: Player | null;
  opponent1_rank?: number | null;
  opponent2_info?: Player | null;
  opponent2_rank?: number | null;
}

interface TournamentWithGames extends Tournament {
  games: GameWithOpponent[];
}

interface TournamentRowProps {
  tournament: TournamentWithGames;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEditTournament: (t: TournamentWithGames) => void;
  onDeleteTournament: (id: string) => void;
  onAddMatch: () => void;
  onEditMatch: (game: GameWithOpponent) => void;
  onDeleteMatch: (id: string) => void;
}

export const TournamentRow: React.FC<TournamentRowProps> = ({
  tournament: t,
  isExpanded,
  onToggleExpand,
  onEditTournament,
  onDeleteTournament,
  onAddMatch,
  onEditMatch,
  onDeleteMatch
}) => {
  return (
    <React.Fragment>
      <tr 
        onClick={onToggleExpand}
        className={`group cursor-pointer transition-all ${isExpanded ? 'bg-gray-900 text-white shadow-2xl scale-[1.01] z-10 relative' : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-100 shadow-sm'}`}
      >
        <td className="px-6 py-4 first:rounded-l-2xl font-black text-xs sm:text-sm whitespace-nowrap">
          {t.date ? t.date.replace(/-/g, '/') : '--'}
        </td>
        <td className="px-6 py-4 text-sm font-black tracking-tight flex items-center gap-3">
          <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-black shrink-0 ${t.match_type?.toLowerCase().includes('double') ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'}`}>
            {t.match_type?.toLowerCase().includes('double') ? 'D' : 'S'}
          </span>
          <div className="flex flex-col">
            <span>{t.name || '名称未設定'}</span>
            <span className={`text-[10px] font-bold ${isExpanded ? 'text-white/40' : 'text-gray-400'}`}>{t.location || '---'}</span>
          </div>
        </td>
        <td className="px-6 py-4 text-center last:rounded-r-2xl">
          <div className="flex items-center justify-center gap-4">
            <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black ${isExpanded ? 'bg-white/10' : 'bg-gray-100 text-gray-500'}`}>{t.games.length}</span>
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={3} className="p-0">
            <div className="bg-gray-50 border-x-4 border-b-4 border-gray-900 rounded-b-[2rem] p-6 animate-in slide-in-from-top-2 duration-300 shadow-2xl mb-8">
              <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-200">
                <h5 className="text-[10px] font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                  試合記録
                </h5>
                <div className="flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); onEditTournament(t); }} className="p-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"><Edit2 size={16} /></button>
                  <button onClick={(e) => { e.stopPropagation(); onDeleteTournament(t.tournament_id); }} className="p-2 bg-white border border-gray-200 text-rose-500 rounded-xl hover:bg-rose-50 transition-colors"><Trash2 size={16} /></button>
                  <button onClick={(e) => { e.stopPropagation(); onAddMatch(); }} className="px-4 py-2 bg-tennis-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-tennis-green-700 active:scale-95 transition-all">
                    <Plus size={14} /> 追加
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                {t.games.map((g, idx) => (
                  <div key={g.game_id} className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:border-tennis-green-100 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${g.result === 'Win' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{idx+1}</div>
                      <div>
                        <div className="text-sm font-black text-gray-900">
                          {g.opponent1_info?.full_name || '---'} {g.opponent2_info ? `/ ${g.opponent2_info.full_name}` : ''}
                        </div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{g.score || '--'}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); onEditMatch(g); }} className="p-2 text-gray-400 hover:text-tennis-green-600 transition-colors"><Edit2 size={16} /></button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteMatch(g.game_id); }} className="p-2 text-gray-400 hover:text-rose-600 transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
                {t.games.length === 0 && <p className="text-center py-10 text-gray-400 text-xs font-bold uppercase tracking-widest">No Matches Recorded</p>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
};
