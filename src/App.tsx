import { useState, useEffect, useCallback } from 'react';
import { supabase } from './utils/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import Auth from './components/Auth';
import DashboardOverview from './components/DashboardOverview';
import PlayerSearch from './components/PlayerSearch';
import MultiPlayerChart from './components/MultiPlayerChart';
import TournamentAnalysis from './components/TournamentAnalysis';
import DataManagement from './components/DataManagement';
import ScoutHub from './components/ScoutHub';
import { Trash2, Menu, X, LogOut, Upload, BarChart3, Search, Database, Download, Presentation, ChevronRight } from 'lucide-react';
import type { Player } from './types/database';
import { TournamentActivity } from './components/TournamentActivity';

function App() {
  const apkDownloadUrl = import.meta.env.VITE_ANDROID_APK_URL || 'https://ubuophysnullisrzyulj.supabase.co/storage/v1/object/public/TennisNote/app-release.apk';
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<'overview' | 'scout' | 'import' | 'draw' | 'data'>('data');
  const [managedPlayers, setManagedPlayers] = useState<Player[]>([]);
  const [activeManagedPlayerId, setActiveManagedPlayerId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontSizeLevel, setFontSizeLevel] = useState<number>(3); // 1 to 5

  const activeManagedPlayer = managedPlayers.find(p => p.player_id === activeManagedPlayerId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setActiveMenu('overview');
      } else {
        setActiveMenu('data');
      }
      setIsAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []); // We keep this empty for initial setup

  // Separate effect to handle the initial redirect after login
  useEffect(() => {
    if (session && activeMenu === 'data') {
      setActiveMenu('overview');
    }
  }, [session, activeMenu]);

  const fetchManagedPlayers = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) return;

    const { data: watchedRecords } = await supabase
      .from('user_watched_players')
      .select('player_id, created_at')
      .eq('user_id', currentSession.user.id)
      .eq('player_type', 'managed')
      .order('created_at', { ascending: false });

    if (watchedRecords && watchedRecords.length > 0) {
      const pIds = watchedRecords.map(w => w.player_id);
      const { data: playersDetail } = await supabase
        .from('players')
        .select('*')
        .in('player_id', pIds);

      if (playersDetail) {
        // Maintain the sort order from watchedRecords (most recent first)
        const sortedPlayers = pIds.map(id => playersDetail.find(p => p.player_id === id)).filter(Boolean) as Player[];
        setManagedPlayers(sortedPlayers);

        // If no active selection yet, or the selection is no longer in the list, set to the latest
        if (!activeManagedPlayerId || !pIds.includes(activeManagedPlayerId)) {
          setActiveManagedPlayerId(sortedPlayers[0].player_id);
        }
      }
    } else {
      setManagedPlayers([]);
      setActiveManagedPlayerId(null);
    }
  }, [activeManagedPlayerId]);

  const handleDeleteManagedPlayer = async () => {
    if (!activeManagedPlayerId || !session) return;
    const confirmDelete = window.confirm(`「${activeManagedPlayer?.full_name || activeManagedPlayerId}」を管理リストから削除しますか？紐づく対戦相手の情報もすべて削除されます。`);
    if (!confirmDelete) return;

    // 1. Delete all associated opponents first
    await supabase
      .from('user_watched_players')
      .delete()
      .eq('user_id', session.user.id)
      .eq('target_managed_player_id', activeManagedPlayerId);

    // 2. Delete the managed player entry
    const { error } = await supabase
      .from('user_watched_players')
      .delete()
      .eq('user_id', session.user.id)
      .eq('player_id', activeManagedPlayerId)
      .eq('player_type', 'managed');

    if (!error) {
      await fetchManagedPlayers();
    }
  };

  useEffect(() => {
    if (session) {
      const refreshTimeout = window.setTimeout(() => {
        void fetchManagedPlayers();
      }, 0);

      const handleRefresh = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.playerType === 'managed') {
          void fetchManagedPlayers();
        }
      };
      window.addEventListener('watched-players-changed', handleRefresh);
      return () => {
        window.clearTimeout(refreshTimeout);
        window.removeEventListener('watched-players-changed', handleRefresh);
      };
    }
  }, [session, fetchManagedPlayers]);

  const changeFontSize = (delta: number) => {
    setFontSizeLevel(prev => Math.min(5, Math.max(1, prev + delta)));
  };

  if (isAuthLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-tennis-green-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tennis-green-600"></div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-tennis-green-50">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Persistent on Desktop, Drawer on Mobile */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 w-64 bg-white border-r border-tennis-green-100 flex flex-col transition-all duration-300 z-40
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-tennis-green-100">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-tennis-green-500 rounded-lg flex items-center justify-center mr-3">
              <span className="text-white font-bold text-sm">TN</span>
            </div>
            <span className="font-bold text-tennis-green-900 text-lg">TennisNoteWeb</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <button
            onClick={() => { setActiveMenu('overview'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center px-4 py-3 rounded-lg font-medium transition-colors ${activeMenu === 'overview' ? 'bg-tennis-green-50 text-tennis-green-700' : 'text-gray-600 hover:bg-tennis-green-50'}`}
          >
            <BarChart3 className="w-5 h-5 mr-3" />
            ダッシュボード
          </button>

          <button
            onClick={() => { setActiveMenu('scout'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center px-4 py-3 rounded-lg font-medium transition-colors ${activeMenu === 'scout' ? 'bg-tennis-green-50 text-tennis-green-700' : 'text-gray-600 hover:bg-tennis-green-50'}`}
          >
            <Search className="w-5 h-5 mr-3" />
            対戦相手
          </button>

          <button
            onClick={() => { setActiveMenu('data'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center px-4 py-3 rounded-lg font-medium transition-colors ${activeMenu === 'data' ? 'bg-tennis-green-50 text-tennis-green-700' : 'text-gray-600 hover:bg-tennis-green-50'}`}
          >
            <Database className="w-5 h-5 mr-3" />
            ランキング
          </button>


          <div className="my-4 border-t border-gray-100 pt-4">
            {session?.user?.email === 'kkoike0423@gmail.com' && (
              <>
                <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Admin Tools</p>
                <button
                  onClick={() => { setActiveMenu('draw'); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center px-4 py-3 rounded-lg font-medium transition-colors ${activeMenu === 'draw' ? 'bg-tennis-green-50 text-tennis-green-700' : 'text-gray-600 hover:bg-tennis-green-50'}`}
                >
                  <Presentation className="w-5 h-5 mr-3" />
                  ドロー分析
                </button>
                <button
                  onClick={() => { setActiveMenu('import'); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center px-4 py-3 rounded-lg font-medium transition-colors ${activeMenu === 'import' ? 'bg-tennis-green-50 text-tennis-green-700' : 'text-gray-600 hover:bg-tennis-green-50'}`}
                >
                  <Upload className="w-5 h-5 mr-3" />
                  CSV取込
                </button>
              </>
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-tennis-green-100 space-y-4">
           {apkDownloadUrl && (
              <a href={apkDownloadUrl} className="flex items-center gap-3 px-4 py-2 text-xs font-bold text-tennis-green-600 bg-tennis-green-50 rounded-xl hover:bg-tennis-green-100 transition-colors">
                <Download size={16} /> APK Download
              </a>
           )}
           
           <div className="px-4 py-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">文字サイズ</p>
              <div className="flex items-center justify-between bg-gray-50 p-2 rounded-xl border border-gray-100">
                <button
                  onClick={() => changeFontSize(-1)}
                  disabled={fontSizeLevel <= 1}
                  className="w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-600 disabled:opacity-30 disabled:shadow-none"
                >
                  <span className="text-sm font-bold">A-</span>
                </button>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-tennis-green-600">Level {fontSizeLevel}</span>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map(l => (
                      <div key={l} className={`w-1.5 h-1.5 rounded-full ${l <= fontSizeLevel ? 'bg-tennis-green-500' : 'bg-gray-200'}`}></div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => changeFontSize(1)}
                  disabled={fontSizeLevel >= 5}
                  className="w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-600 disabled:opacity-30 disabled:shadow-none"
                >
                  <span className="text-lg font-bold">A+</span>
                </button>
              </div>
           </div>

          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center w-full px-4 py-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
          >
            <LogOut className="w-4 h-4 mr-3" />
            ログアウト
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10 bg-white">
        <header className="h-16 lg:h-20 flex items-center justify-between px-6 border-b border-gray-50 bg-white z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-gray-400 hover:bg-gray-50 rounded-full"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-gray-800 tracking-tight truncate max-w-[120px] sm:max-w-none whitespace-nowrap">
              {activeMenu === 'overview' ? 'ダッシュボード' :
                activeMenu === 'scout' ? '対戦相手' :
                  activeMenu === 'draw' ? 'ドロー分析' :
                    activeMenu === 'data' ? 'ランキング' : '設定'}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Desktop Font Stepper */}
             <div className="hidden sm:flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100 mr-2">
                <button
                  onClick={() => changeFontSize(-1)}
                  disabled={fontSizeLevel <= 1}
                  className="px-3 py-1 text-xs font-bold text-gray-500 hover:text-tennis-green-600 disabled:opacity-30 transition-colors"
                >
                  A-
                </button>
                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                <button
                  onClick={() => changeFontSize(1)}
                  disabled={fontSizeLevel >= 5}
                  className="px-3 py-1 text-lg font-bold text-gray-500 hover:text-tennis-green-600 disabled:opacity-30 transition-colors"
                >
                  A+
                </button>
             </div>

             <div className="flex flex-col items-end hidden sm:block">
                <p className="text-[10px] font-bold text-gray-400 leading-none">Logged in as</p>
                <p className="text-xs font-bold text-tennis-green-700">{session.user.email?.split('@')[0]}</p>
             </div>
             <div className="w-8 h-8 rounded-full bg-tennis-green-100 flex items-center justify-center text-tennis-green-700 font-bold border-2 border-white shadow-sm">
                {session.user.email?.[0].toUpperCase()}
             </div>
          </div>
        </header>

        <div className={`flex-1 overflow-auto p-4 lg:p-8 pb-24 lg:pb-8 relative ${
          fontSizeLevel === 1 ? 'text-xs' :
            fontSizeLevel === 2 ? 'text-sm' :
              fontSizeLevel === 4 ? 'text-lg' :
                fontSizeLevel === 5 ? 'text-xl' : 'text-base'
        }`}>
          <div className="max-w-4xl mx-auto z-10 relative">
            {activeMenu === 'overview' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center justify-between bg-tennis-green-900 text-white p-4 sm:p-5 rounded-3xl shadow-xl overflow-hidden relative">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                   <div className="relative z-10">
                      <p className="text-tennis-green-300 text-[10px] font-black uppercase tracking-widest mb-1">Monitoring Player</p>
                      <div className="flex items-center gap-3 group relative">
                        <select
                          className="bg-transparent text-xl font-bold outline-none appearance-none cursor-pointer pr-8"
                          value={activeManagedPlayerId || ''}
                          onChange={(e) => setActiveManagedPlayerId(e.target.value)}
                        >
                          {managedPlayers.length === 0 ? (
                            <option value="">登録なし</option>
                          ) : (
                            managedPlayers.map(p => (
                              <option key={p.player_id} value={p.player_id} className="text-gray-800 text-lg">
                                {p.last_name} 選手
                              </option>
                            ))
                          )}
                        </select>
                        <ChevronRight className="text-tennis-green-400 rotate-90 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none group-hover:scale-110 transition-transform" size={20} />
                      </div>
                   </div>
                   <button 
                    onClick={handleDeleteManagedPlayer}
                    className="relative z-10 w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 hover:bg-rose-500 hover:border-rose-400 transition-all shadow-sm"
                   >
                      <Trash2 className="text-white" size={20} />
                   </button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                   <TournamentActivity 
                     activeManagedPlayerId={activeManagedPlayerId} 
                     userEmail={session?.user?.email}
                   />
                   
                   <MultiPlayerChart
                    playerType="managed"
                    title="ランキング推移"
                    activeManagedPlayerId={activeManagedPlayerId}
                  />
                </div>

                <PlayerSearch
                  playerType="managed"
                  title="管理選手を追加・削除"
                  activeManagedPlayerId={activeManagedPlayerId}
                />
              </div>
            )}

            {activeMenu === 'scout' && (
               <ScoutHub activeManagedPlayerId={activeManagedPlayerId} />
            )}

            {activeMenu === 'draw' && session?.user?.email === 'kkoike0423@gmail.com' && <TournamentAnalysis />}
            {activeMenu === 'data' && (
              <DataManagement 
                initialCategory={activeManagedPlayer?.category} 
                initialGender={activeManagedPlayer?.gender} 
              />
            )}
            {activeMenu === 'import' && <DashboardOverview />}
          </div>

          <div className="fixed top-0 right-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-[10%] -right-[5%] w-[40%] h-[40%] rounded-full bg-gradient-to-br from-tennis-green-100 to-transparent opacity-40 blur-3xl"></div>
            <div className="absolute bottom-[5%] -left-[5%] w-[30%] h-[30%] rounded-full bg-gradient-to-tr from-tennis-green-50 to-transparent opacity-30 blur-3xl"></div>
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-gray-100 px-3 sm:px-6 py-2 flex items-center justify-between z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-[1.5rem]">
          <button
            onClick={() => setActiveMenu('overview')}
            className={`flex flex-col items-center gap-1 transition-all flex-1 py-1 min-w-0 ${activeMenu === 'overview' ? 'text-tennis-green-600 scale-105 font-bold' : 'text-gray-400'}`}
          >
            <BarChart3 size={20} className="sm:size-6" strokeWidth={activeMenu === 'overview' ? 2.5 : 2} />
            <span className="text-[9px] sm:text-[10px] truncate w-full text-center">ホーム</span>
          </button>

          <button
            onClick={() => setActiveMenu('scout')}
            className={`flex flex-col items-center gap-1 transition-all flex-1 py-1 min-w-0 ${activeMenu === 'scout' ? 'text-tennis-green-600 scale-105 font-bold' : 'text-gray-400'}`}
          >
            <Search size={20} className="sm:size-6" strokeWidth={activeMenu === 'scout' ? 2.5 : 2} />
            <span className="text-[9px] sm:text-[10px] truncate w-full text-center">対戦相手</span>
          </button>

          <button
            onClick={() => setActiveMenu('data')}
            className={`flex flex-col items-center gap-1 transition-all flex-1 py-1 min-w-0 ${activeMenu === 'data' ? 'text-tennis-green-600 scale-105 font-bold' : 'text-gray-400'}`}
          >
            <Database size={20} className="sm:size-6" strokeWidth={activeMenu === 'data' ? 2.5 : 2} />
            <span className="text-[9px] sm:text-[10px] truncate w-full text-center">ランキング</span>
          </button>

          {session?.user?.email === 'kkoike0423@gmail.com' && (
            <button
              onClick={() => setActiveMenu('draw')}
              className={`flex flex-col items-center gap-1 transition-all flex-1 py-1 min-w-0 ${activeMenu === 'draw' ? 'text-tennis-green-600 scale-105 font-bold' : 'text-gray-400'}`}
            >
              <Presentation size={20} className="sm:size-6" strokeWidth={activeMenu === 'draw' ? 2.5 : 2} />
              <span className="text-[9px] sm:text-[10px] truncate w-full text-center">ドロー</span>
            </button>
          )}
          
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex flex-col items-center gap-1 transition-all flex-1 py-1 text-gray-400 min-w-0"
          >
            <Menu size={20} className="sm:size-6" />
            <span className="text-[9px] sm:text-[10px] truncate w-full text-center">その他</span>
          </button>
        </nav>
      </main>
    </div>
  );
}

export default App;
