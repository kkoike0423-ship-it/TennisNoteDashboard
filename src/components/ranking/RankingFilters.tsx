import React from 'react';
import { Search, Users, Table } from 'lucide-react';

interface RankingFiltersProps {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  availableGenders: string[];
  selectedGender: string;
  onGenderChange: (gender: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const RankingFilters: React.FC<RankingFiltersProps> = ({
  categories,
  selectedCategory,
  onCategoryChange,
  availableGenders,
  selectedGender,
  onGenderChange,
  searchQuery,
  onSearchChange,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Gender Filter */}
      <div className="glass-panel p-6 shadow-sm flex flex-col gap-4">
        <label className="text-sm font-bold text-gray-600 flex items-center gap-2">
          <Users size={16} /> 性別
        </label>
        <div className="flex flex-col bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
          <button
            onClick={() => onGenderChange('all')}
            className={`flex-1 py-3 px-3 text-sm font-bold transition-all border-b border-gray-200 last:border-none ${
              selectedGender === 'all'
                ? 'bg-white text-tennis-green-600 shadow-inner'
                : 'text-gray-400 hover:text-gray-600 bg-transparent'
            }`}
          >
            すべて
          </button>
          {availableGenders.map(g => (
            <button
              key={g}
              onClick={() => onGenderChange(g)}
              className={`flex-1 py-3 px-3 text-sm font-bold transition-all border-b border-gray-200 last:border-none ${
                selectedGender === g
                  ? 'bg-white text-tennis-green-600 shadow-inner'
                  : 'text-gray-400 hover:text-gray-600 bg-transparent'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      <div className="md:col-span-1 glass-panel p-6 shadow-sm flex flex-col gap-4">
        <label className="text-sm font-bold text-gray-600 flex items-center gap-2">
          <Table size={16} /> カテゴリー
        </label>
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                selectedCategory === cat
                  ? 'bg-tennis-green-500 text-white shadow-md transform scale-105'
                  : 'bg-white text-gray-500 hover:bg-tennis-green-50 border border-gray-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Search Filter */}
      <div className="md:col-span-1 glass-panel p-6 shadow-sm flex flex-col gap-4">
        <label className="text-sm font-bold text-gray-600 flex items-center gap-2">
          <Search size={16} /> 選手名・所属
        </label>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="検索..."
            className="w-full pl-12 pr-4 py-3 bg-white/50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-tennis-green-500 transition-all font-medium"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
