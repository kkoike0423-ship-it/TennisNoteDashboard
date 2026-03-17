import { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import Auth from './components/Auth';
import DashboardOverview from './components/DashboardOverview';
import PlayerSearch from './components/PlayerSearch';
import MultiPlayerChart from './components/MultiPlayerChart';
import DataManagement from './components/DataManagement';
import ScoutHub from './components/ScoutHub';
import { Trash2, BarChart3, Search, Database, Menu } from 'lucide-react';
import { TournamentActivity } from './components/TournamentActivity';
import { useManagedPlayers } from './contexts/ManagedPlayerContext';
import { Card } from './components/ui';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<'overview' | 'scout' | 'import' | 'data'>('data');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontSizeLevel, setFontSizeLevel] = useState<number>(3); // 1 to 5

  const {
    managedPlayers,
    activeManagedPlayerId,
    activeManagedPlayer, 
    setActiveManagedPlayerId, 
    deleteManagedPlayer,
  } = useManagedPlayers();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) setActiveMenu('overview');
      else setActiveMenu('data');
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);



  const handleDeleteManagedPlayer = async () => {
    if (!activeManagedPlayerId) return;
    const name = activeManagedPlayer?.full_name || activeManagedPlayerId;
    if (window.confirm(`「${name}」を管理リストから削除しますか？紐づく対戦相手の情報もすべて削除されます。`)) {
      await deleteManagedPlayer(activeManagedPlayerId);
    }
  };

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
    return <Auth onAuthSuccess={() => setActiveMenu('overview')} />;
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        activeMenu={activeMenu} 
        setActiveMenu={setActiveMenu} 
        session={session}
        fontSizeLevel={fontSizeLevel}
        onFontSizeChange={changeFontSize}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10 bg-white">
        <Header 
          activeMenu={activeMenu} 
          onOpenSidebar={() => setIsSidebarOpen(true)} 
          fontSizeLevel={fontSizeLevel} 
          onFontSizeChange={changeFontSize} 
          session={session} 
        />

        <div className={`flex-1 overflow-auto p-4 lg:p-8 pb-24 lg:pb-8 relative ${
          fontSizeLevel === 1 ? 'text-xs' :
            fontSizeLevel === 2 ? 'text-sm' :
              fontSizeLevel === 4 ? 'text-lg' :
                fontSizeLevel === 5 ? 'text-xl' : 'text-base'
        }`}>
          <div className="max-w-4xl mx-auto z-10 relative">
            {activeMenu === 'overview' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <Card className="flex items-center justify-between bg-tennis-green-900 text-white p-4 sm:p-5 rounded-[2rem] shadow-2xl relative">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                   <div className="relative z-10 flex-1">
                      <p className="text-tennis-green-300 text-[10px] font-black uppercase tracking-[0.2em] mb-2 font-mono">Monitoring Player</p>
                      <div className="flex items-center gap-3">
                        <select
                          className="bg-transparent text-xl sm:text-2xl font-black outline-none appearance-none cursor-pointer pr-10 border-b-2 border-tennis-green-700 hover:border-tennis-green-400 transition-colors w-full"
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
                      </div>
                   </div>
                   <button 
                    onClick={handleDeleteManagedPlayer}
                    className="ml-4 w-14 h-14 bg-rose-500 text-white rounded-2xl flex items-center justify-center hover:bg-rose-600 transition-all shadow-lg active:scale-95"
                   >
                      <Trash2 size={24} />
                   </button>
                </Card>

                <div className="grid grid-cols-1 gap-8">
                   <TournamentActivity 
                     activeManagedPlayerId={activeManagedPlayerId} 
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
                />
              </div>
            )}

            {activeMenu === 'scout' && <ScoutHub />}
            {activeMenu === 'data' && <DataManagement initialCategory={activeManagedPlayer?.category} initialGender={activeManagedPlayer?.gender} />}
            {activeMenu === 'import' && <DashboardOverview />}
          </div>

          {/* Decorative Gradients */}
          <div className="fixed top-0 right-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-[10%] -right-[5%] w-[40%] h-[40%] rounded-full bg-gradient-to-br from-tennis-green-100 to-transparent opacity-40 blur-3xl"></div>
            <div className="absolute bottom-[5%] -left-[5%] w-[30%] h-[30%] rounded-full bg-gradient-to-tr from-tennis-green-50 to-transparent opacity-30 blur-3xl"></div>
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] bg-gray-900/95 backdrop-blur-2xl px-4 py-3 flex items-center justify-between z-50 shadow-2xl rounded-3xl border border-white/10">
          {[
            { id: 'overview', label: 'ホーム', icon: BarChart3 },
            { id: 'scout', label: '対戦', icon: Search },
            { id: 'data', label: 'ランク', icon: Database },
            { id: 'sidebar', label: '他', icon: Menu }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => item.id === 'sidebar' ? setIsSidebarOpen(true) : setActiveMenu(item.id as any)}
              className={`flex flex-col items-center gap-1 transition-all flex-1 py-1 min-w-0 ${activeMenu === item.id ? 'text-tennis-green-400 scale-110 font-bold' : 'text-gray-400'}`}
            >
              <item.icon size={20} strokeWidth={activeMenu === item.id ? 2.5 : 2} />
              <span className="text-[9px] font-black uppercase tracking-widest truncate w-full text-center">{item.label}</span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}

export default App;
