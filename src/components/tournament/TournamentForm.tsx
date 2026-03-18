import React, { useState } from 'react';
import { Button, Input, Select } from '../ui';
import { type Tournament } from '../../types/database';
import { X } from 'lucide-react';

interface TournamentFormProps {
  initialData: Partial<Tournament>;
  isProcessing: boolean;
  onSave: (data: Partial<Tournament>) => Promise<void>;
  onCancel: () => void;
  title: string;
}

export const TournamentForm: React.FC<TournamentFormProps> = ({
  initialData,
  isProcessing,
  onSave,
  onCancel,
  title
}) => {
  const [formData, setFormData] = useState<Partial<Tournament>>(initialData);

  return (
    <div id="tournament-edit-form" className="mb-10 p-5 sm:p-10 bg-gray-900 rounded-2xl sm:rounded-[2.5rem] text-white shadow-3xl relative overflow-hidden scroll-mt-24 border-2 border-white/5 mx-[-1rem] sm:mx-0">
      <div className="absolute top-0 left-0 w-64 h-64 bg-tennis-green-600/10 blur-[100px] rounded-full -ml-32 -mt-32"></div>
      
      <div className="flex items-center justify-between mb-8 relative z-10">
        <h4 className="font-extrabold text-xl sm:text-2xl tracking-tighter">{title}</h4>
        <Button disabled={isProcessing} onClick={onCancel} className="w-10 h-10 flex items-center justify-center bg-white/10 text-white rounded-full hover:bg-white/20 transition-all active:scale-90 shadow-lg">
          <X size={20} />
        </Button>
      </div>

      <div className="space-y-6 relative z-10">
        <Input 
          label="大会名 / Tournament Name" 
          disabled={isProcessing} 
          placeholder="大会名称を入力..." 
          value={formData.name || ''} 
          onChange={e => setFormData({...formData, name: e.target.value})}
          className="bg-white/10 border-white/10 text-white focus:border-tennis-green-400 font-bold"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input 
            label="開催日 / Date" 
            type="date" 
            disabled={isProcessing} 
            value={formData.date || ''} 
            onChange={e => setFormData({...formData, date: e.target.value})}
            className="bg-white/10 border-white/10 text-white focus:border-tennis-green-400 font-bold"
          />
          <Input 
            label="開催地 / Location" 
            disabled={isProcessing} 
            placeholder="会場・地域など..." 
            value={formData.location || ''} 
            onChange={e => setFormData({...formData, location: e.target.value})}
            className="bg-white/10 border-white/10 text-white focus:border-tennis-green-400 font-bold"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Select 
            label="カテゴリー / Category" 
            disabled={isProcessing} 
            value={formData.category || ''} 
            onChange={e => setFormData({...formData, category: e.target.value})}
            className="bg-white/10 border-white/10 text-white focus:border-tennis-green-400 font-bold"
          >
            <option value="">選択してください</option>
            <option value="U12">U12</option>
            <option value="U14">U14</option>
            <option value="U16">U16</option>
            <option value="U18">U18</option>
            <option value="General">一般</option>
          </Select>

          <div>
            <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">種目 / Match Type</label>
            <div className="flex gap-3">
              {[
                { label: 'シングルス', value: 'Single' },
                { label: 'ダブルス', value: 'Double' }
              ].map(type => (
                <button
                  key={type.value}
                  disabled={isProcessing}
                  onClick={() => setFormData({...formData, match_type: type.value})}
                  className={`flex-1 py-4 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${formData.match_type === type.value ? 'bg-tennis-green-500 text-white shadow-xl scale-105 z-10' : 'bg-white/5 text-white/30 hover:bg-white/10 border border-white/10'}`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex gap-4 mt-8">
          <Button 
            disabled={isProcessing} 
            loading={isProcessing} 
            onClick={() => onSave(formData)} 
            className="flex-[2] py-4 rounded-xl font-black shadow-xl"
          >
            保存する
          </Button>
          <Button 
            variant="secondary" 
            disabled={isProcessing} 
            onClick={onCancel} 
            className="flex-1 py-4 rounded-xl font-bold"
          >
            キャンセル
          </Button>
        </div>
      </div>
    </div>
  );
};
