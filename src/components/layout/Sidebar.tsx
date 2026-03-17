import React from 'react';
import { supabase } from '../../utils/supabaseClient';
import { 
  X, LogOut, Upload, BarChart3, Search, Database, Download
} from 'lucide-react';
import { type Session } from '@supabase/supabase-js';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeMenu: string;
  setActiveMenu: (menu: any) => void;
  session: Session | null;
  fontSizeLevel: number;
  onFontSizeChange: (delta: number) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  activeMenu,
  setActiveMenu,
  session,
  fontSizeLevel,
  onFontSizeChange
}) => {
  const apkDownloadUrl = import.meta.env.VITE_ANDROID_APK_URL;

  const navItems = [
    { id: 'overview', label: 'ダッシュボード', icon: BarChart3 },
    { id: 'scout', label: '対戦相手', icon: Search },
    { id: 'data', label: 'ランキング', icon: Database },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 w-72 bg-white border-r border-tennis-green-100 flex flex-col z-50 transition-transform duration-300 lg:relative lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-tennis-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-tennis-green-200">
              <BarChart3 className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-900 tracking-tighter leading-none">TennisNote</h1>
              <p className="text-[10px] font-bold text-tennis-green-600 uppercase tracking-widest mt-1">Dashboard</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-gray-400 hover:bg-gray-50 rounded-full">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Main Menu</p>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveMenu(item.id); onClose(); }}
              className={`w-full flex items-center px-4 py-3 rounded-xl font-bold transition-all ${activeMenu === item.id ? 'bg-tennis-green-600 text-white shadow-lg shadow-tennis-green-100 scale-[1.02]' : 'text-gray-500 hover:bg-tennis-green-50 hover:text-gray-900'}`}
            >
              <item.icon className="w-5 h-5 mr-3" strokeWidth={activeMenu === item.id ? 2.5 : 2} />
              {item.label}
            </button>
          ))}

          {session?.user?.email === 'kkoike0423@gmail.com' && (
            <div className="mt-8">
              <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Admin Tools</p>
              <button
                onClick={() => { setActiveMenu('import'); onClose(); }}
                className={`w-full flex items-center px-4 py-3 rounded-xl font-bold transition-all ${activeMenu === 'import' ? 'bg-tennis-green-600 text-white shadow-lg shadow-tennis-green-100 scale-[1.02]' : 'text-gray-500 hover:bg-tennis-green-50 hover:text-gray-900'}`}
              >
                <Upload className="w-5 h-5 mr-3" />
                CSV取込
              </button>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-gray-50 space-y-4">
          {apkDownloadUrl && (
            <a href={apkDownloadUrl} className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-tennis-green-700 bg-tennis-green-50 rounded-xl hover:bg-tennis-green-100 transition-colors border border-tennis-green-100">
              <Download size={18} /> APK Download
            </a>
          )}
          
          <div className="px-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 ml-2">文字サイズ</p>
            <div className="flex items-center justify-between bg-gray-50 p-2 rounded-2xl border border-gray-100">
              <button
                onClick={() => onFontSizeChange(-1)}
                disabled={fontSizeLevel <= 1}
                className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-gray-600 disabled:opacity-30"
              >
                <span className="text-sm font-bold">A-</span>
              </button>
              <div className="flex flex-col items-center">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(l => (
                    <div key={l} className={`w-1.5 h-1.5 rounded-full transition-all ${l <= fontSizeLevel ? 'bg-tennis-green-500 scale-110' : 'bg-gray-200'}`}></div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => onFontSizeChange(1)}
                disabled={fontSizeLevel >= 5}
                className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-gray-600 disabled:opacity-30"
              >
                <span className="text-lg font-bold">A+</span>
              </button>
            </div>
          </div>

          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center w-full px-4 py-3 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all font-bold text-sm"
          >
            <LogOut className="w-5 h-5 mr-3" />
            ログアウト
          </button>
        </div>
      </aside>
    </>
  );
};
