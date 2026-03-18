import React from 'react';
import { TournamentRow } from './TournamentRow';
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

interface TournamentListProps {
  groupedTournaments: [string, TournamentWithGames[]][];
  expandedTournament: string | null;
  onToggleExpand: (id: string) => void;
  onEditTournament: (t: TournamentWithGames) => void;
  onDeleteTournament: (id: string) => void;
  onAddMatch: (tournamentId: string) => void;
  onEditMatch: (tournamentId: string, game: GameWithOpponent) => void;
  onDeleteMatch: (id: string) => void;
}

export const TournamentList: React.FC<TournamentListProps> = ({
  groupedTournaments,
  expandedTournament,
  onToggleExpand,
  onEditTournament,
  onDeleteTournament,
  onAddMatch,
  onEditMatch,
  onDeleteMatch
}) => {
  if (groupedTournaments.length === 0) {
    return (
      <div className="py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
        <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No Data Found</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {groupedTournaments.map(([month, monthTournaments]) => (
        <div key={month} className="animate-in fade-in duration-500">
          <div className="flex items-center gap-4 mb-6">
            <div className="px-5 py-2.5 bg-gray-900 text-white rounded-2xl text-xs font-black tracking-widest shadow-xl font-mono">
              {month.replace('-', ' / ')}
            </div>
            <div className="h-[2px] flex-1 bg-gradient-to-r from-gray-100 to-transparent"></div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <th className="px-6 py-4 text-left w-[18%]">日付</th>
                  <th className="px-6 py-4 text-left">大会名 / 開催地</th>
                  <th className="px-6 py-4 text-center w-[22%]">試合数</th>
                </tr>
              </thead>
              <tbody>
                {monthTournaments.map(t => (
                  <TournamentRow 
                    key={t.tournament_id}
                    tournament={t}
                    isExpanded={expandedTournament === t.tournament_id}
                    onToggleExpand={() => onToggleExpand(t.tournament_id)}
                    onEditTournament={onEditTournament}
                    onDeleteTournament={onDeleteTournament}
                    onAddMatch={() => onAddMatch(t.tournament_id)}
                    onEditMatch={(game) => onEditMatch(t.tournament_id, game)}
                    onDeleteMatch={onDeleteMatch}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};
