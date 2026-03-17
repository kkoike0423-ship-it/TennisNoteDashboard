import React from 'react';
import { Menu } from 'lucide-react';
import { type Session } from '@supabase/supabase-js';

interface HeaderProps {
  activeMenu: string;
  onOpenSidebar: () => void;
  fontSizeLevel: number;
  onFontSizeChange: (delta: number) => void;
  session: Session | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeMenu,
  onOpenSidebar,
  fontSizeLevel,
  onFontSizeChange,
  session
}) => {
  const titles: Record<string, string> = {
    overview: 'ダッシュボード',
    scout: '対戦相手',
    data: 'ランキング',
    import: 'データ取込',
    settings: '設定'
  };

  return (
    <header className="h-16 lg:h-20 flex items-center justify-between px-6 border-b border-gray-50 bg-white z-20">
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 -ml-2 text-gray-400 hover:bg-gray-50 rounded-full"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-base sm:text-lg font-bold text-gray-800 tracking-tight truncate max-w-[120px] sm:max-w-none whitespace-nowrap">
          {titles[activeMenu] || 'テニスノート'}
        </h1>
      </div>
      
      <div className="flex items-center gap-3">
        {/* Desktop Font Stepper */}
        <div className="hidden sm:flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100 mr-2">
          <button
            onClick={() => onFontSizeChange(-1)}
            disabled={fontSizeLevel <= 1}
            className="px-3 py-1 text-xs font-bold text-gray-500 hover:text-tennis-green-600 disabled:opacity-30 transition-colors"
          >
            A-
          </button>
          <div className="w-px h-4 bg-gray-200 mx-1"></div>
          <button
            onClick={() => onFontSizeChange(1)}
            disabled={fontSizeLevel >= 5}
            className="px-3 py-1 text-lg font-bold text-gray-500 hover:text-tennis-green-600 disabled:opacity-30 transition-colors"
          >
            A+
          </button>
        </div>

        {session && (
          <>
            <div className="flex flex-col items-end hidden sm:block">
              <p className="text-[10px] font-bold text-gray-400 leading-none">Logged in as</p>
              <p className="text-xs font-bold text-tennis-green-700">{session.user.email?.split('@')[0]}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-tennis-green-100 flex items-center justify-center text-tennis-green-700 font-bold border-2 border-white shadow-sm">
              {session.user.email?.[0].toUpperCase()}
            </div>
          </>
        )}
      </div>
    </header>
  );
};
