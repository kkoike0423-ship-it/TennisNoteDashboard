import React, { useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Trash2, X } from 'lucide-react';
import { type Game, type Player } from '../../types/database';
import { Button, Input } from '../ui';

interface GameWithOpponent extends Game {
  opponent1_info?: Player | null;
  opponent2_info?: Player | null;
}

interface MatchFormProps {
  tournament: { name: string; match_type?: string; format?: string };
  editingGame: { tournamentId: string; game: Partial<GameWithOpponent> };
  isProcessing: boolean;
  onSave: (game: Partial<GameWithOpponent>) => Promise<void>;
  onDelete: (id: string) => Promise<boolean>;
  onCancel: () => void;
}

export const MatchForm: React.FC<MatchFormProps> = ({
  tournament,
  editingGame: initialEditingGame,
  isProcessing,
  onSave,
  onDelete,
  onCancel
}) => {
  const [localGame, setLocalGame] = useState<Partial<GameWithOpponent>>(initialEditingGame.game);
  const [opponentSearch, setOpponentSearch] = useState(localGame.opponent1_info?.full_name || localGame.opponent1_id || '');
  const [opponentSearch2, setOpponentSearch2] = useState(localGame.opponent2_info?.full_name || localGame.opponent2_id || '');
  const [opponentSuggestions, setOpponentSuggestions] = useState<Player[]>([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState<1 | 2>(1);

  const isDouble = (tournament.match_type || tournament.format || '').toLowerCase().includes('double');

  const searchOpponents = async (term: string, index: 1 | 2) => {
    setActiveSearchIndex(index);
    if (index === 1) setOpponentSearch(term);
    else setOpponentSearch2(term);

    if (term.length < 1) {
      setOpponentSuggestions([]);
      return;
    }

    const { data } = await supabase
      .from('players')
      .select('*')
      .or(`full_name.ilike.%${term}%,last_name.ilike.%${term}%,first_name.ilike.%${term}%`)
      .limit(10);
    
    setOpponentSuggestions(data || []);
  };

  const updateSetScore = (setNum: number, field: 'self' | 'opp', value: string) => {
    const val = parseInt(value) || 0;
    setLocalGame(prev => ({
      ...prev,
      [`set${setNum}_${field}`]: val
    }));
  };

  return (
    <div id="game-edit-form" className="mb-8 p-5 sm:p-10 bg-gray-900 rounded-2xl sm:rounded-3xl text-white shadow-3xl relative overflow-hidden scroll-mt-24 border-2 border-white/5 mx-[-1rem] sm:mx-0">
      <div className="absolute top-0 right-0 w-64 h-64 bg-tennis-green-600/10 blur-[100px] rounded-full"></div>
      
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex flex-col gap-1">
          <h6 className="font-bold text-lg sm:text-2xl tracking-tighter">試合結果の記録</h6>
          <p className="text-[10px] font-bold text-white/30 truncate max-w-[200px] sm:max-w-none uppercase tracking-widest">{tournament.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {localGame.game_id && !localGame.game_id.startsWith('G-') && (
            <button 
              disabled={isProcessing} 
              onClick={() => onDelete(localGame.game_id!)} 
              className="w-10 h-10 flex items-center justify-center bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-all active:scale-90 shadow-lg disabled:opacity-30"
            >
              <Trash2 size={20} />
            </button>
          )}
          <button disabled={isProcessing} onClick={onCancel} className="w-10 h-10 flex items-center justify-center bg-white/10 text-white rounded-full hover:bg-white/20 transition-all active:scale-90 disabled:opacity-30 shadow-lg"><X size={20} /></button>
        </div>
      </div>

      <div className="space-y-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative">
            <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3">Opponent 1 {isDouble ? '/ 対戦相手1' : '/ 対戦相手'}</label>
            <Input 
              disabled={isProcessing} 
              type="text" 
              placeholder="氏名を入力..." 
              value={opponentSearch} 
              onChange={e => searchOpponents(e.target.value, 1)} 
              className="bg-white/10 border-white/10 text-white focus:border-tennis-green-400 font-bold h-14"
            />
            {opponentSuggestions.length > 0 && activeSearchIndex === 1 && (
              <div className="absolute top-full left-0 w-full mt-2 bg-white text-gray-900 rounded-2xl shadow-3xl z-50 overflow-hidden max-h-60 overflow-y-auto border-2 border-gray-900">
                {opponentSuggestions.map(p => (
                  <button key={p.player_id} className="w-full text-left px-5 py-3 hover:bg-tennis-green-50 transition-colors border-b border-gray-100 last:border-0" onClick={() => { setLocalGame(prev => ({...prev, opponent1_id: p.player_id})); setOpponentSuggestions([]); setOpponentSearch(p.full_name); }}>
                    <div className="flex items-center justify-between font-bold text-sm">{p.full_name} <span className="text-[10px] text-tennis-green-600 bg-tennis-green-100 px-2 py-0.5 rounded-full">{p.ranking_point}pt</span></div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{p.team} | {p.category}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {isDouble && (
            <div className="relative">
              <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3">Opponent 2 / 対戦相手2</label>
              <Input 
                disabled={isProcessing} 
                type="text" 
                placeholder="氏名を入力..." 
                value={opponentSearch2} 
                onChange={e => searchOpponents(e.target.value, 2)} 
                className="bg-white/10 border-white/10 text-white focus:border-tennis-green-400 font-bold h-14"
              />
              {opponentSuggestions.length > 0 && activeSearchIndex === 2 && (
                <div className="absolute top-full left-0 w-full mt-2 bg-white text-gray-900 rounded-2xl shadow-3xl z-50 overflow-hidden max-h-60 overflow-y-auto border-2 border-gray-900">
                  {opponentSuggestions.map(p => (
                    <button key={p.player_id} className="w-full text-left px-5 py-3 hover:bg-tennis-green-50 transition-colors border-b border-gray-100 last:border-0" onClick={() => { setLocalGame(prev => ({...prev, opponent2_id: p.player_id})); setOpponentSuggestions([]); setOpponentSearch2(p.full_name); }}>
                      <div className="flex items-center justify-between font-bold text-sm">{p.full_name} <span className="text-[10px] text-tennis-green-600 bg-tennis-green-100 px-2 py-0.5 rounded-full">{p.ranking_point}pt</span></div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{p.team} | {p.category}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3">
          {[1, 2, 3, 4, 5].map(setNum => (
            <div key={setNum} className="bg-white/5 p-2 sm:p-3 rounded-xl border border-white/10">
              <p className="text-[9px] font-black text-center mb-2 text-white/20 uppercase tracking-widest">Set {setNum}</p>
              <div className="flex gap-1 sm:gap-1.5 font-mono">
                <input disabled={isProcessing} type="number" className="w-full bg-white text-gray-900 text-center py-1 sm:py-2 rounded-lg font-black text-sm sm:text-base disabled:opacity-50" value={(localGame[`set${setNum}_self` as keyof Game] as number) || 0} onChange={e => updateSetScore(setNum, 'self', e.target.value)} />
                <input disabled={isProcessing} type="number" className="w-full bg-white text-gray-900 text-center py-1 sm:py-2 rounded-lg font-black text-sm sm:text-base disabled:opacity-50" value={(localGame[`set${setNum}_opp` as keyof Game] as number) || 0} onChange={e => updateSetScore(setNum, 'opp', e.target.value)} />
              </div>
            </div>
          ))}
          <div className="bg-tennis-green-500/10 p-2 sm:p-3 rounded-xl border border-tennis-green-500/20">
            <p className="text-[9px] font-black text-center mb-2 text-tennis-green-400 uppercase tracking-widest">TieBreak</p>
            <div className="flex gap-1.5 font-mono">
              <input disabled={isProcessing} type="number" className="w-full bg-white text-gray-900 text-center py-2 rounded-lg font-black text-base border border-tennis-green-500/20 disabled:opacity-50" value={localGame.tb_self || 0} onChange={e => setLocalGame({ ...localGame, tb_self: parseInt(e.target.value) || 0 })} />
              <input disabled={isProcessing} type="number" className="w-full bg-white text-gray-900 text-center py-2 rounded-lg font-black text-base border border-tennis-green-500/20 disabled:opacity-50" value={localGame.tb_opp || 0} onChange={e => setLocalGame({ ...localGame, tb_opp: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Outcome / 勝敗結果</label>
            <div className="flex gap-2">
              {['Win', 'Loss', 'Bye'].map(r => (
                <button disabled={isProcessing} key={r} onClick={() => setLocalGame({ ...localGame, result: r })} className={`flex-1 py-4 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all disabled:opacity-50 ${localGame.result === r ? 'bg-tennis-green-500 text-white shadow-xl scale-105 z-10' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}>
                  {r === 'Loss' ? 'Loser' : r === 'Win' ? 'Winner' : 'Bye'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Custom Score / スコア修正 (任意)</label>
            <input disabled={isProcessing} type="text" className="w-full px-5 py-4 bg-white/10 border-2 border-white/10 rounded-xl focus:border-tennis-green-400 outline-none text-base font-bold text-white disabled:opacity-50 placeholder-white/10" placeholder="例: 6-4, 6-2 (自動生成されます)" value={localGame.score || ''} onChange={e => setLocalGame({ ...localGame, score: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Post-Match Memo / 分析・感想</label>
          <textarea disabled={isProcessing} className="w-full px-5 py-4 bg-white/10 border-2 border-white/10 rounded-2xl focus:border-tennis-green-400 outline-none h-32 resize-none text-base font-medium leading-relaxed text-white disabled:opacity-50 placeholder-white/20" placeholder="この試合の振り返りや、次の課題などを入力してください..." value={localGame.memo || ''} onChange={e => setLocalGame({ ...localGame, memo: e.target.value })}></textarea>
        </div>

        <Button 
          disabled={isProcessing} 
          loading={isProcessing} 
          onClick={() => onSave(localGame)} 
          className="w-full py-5 rounded-2xl text-base font-black shadow-2xl"
        >
          {localGame.game_id && !localGame.game_id.startsWith('G-') ? '試合結果を更新' : '試合結果を登録'}
        </Button>
      </div>
    </div>
  );
};
