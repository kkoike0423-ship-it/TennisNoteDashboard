import { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import Auth from './components/Auth';
import DashboardOverview from './components/DashboardOverview';
import PlayerSearch from './components/PlayerSearch';
import MultiPlayerChart from './components/MultiPlayerChart';
import { Trash2, Users, UserCheck, Menu, X, LogOut, Upload, BarChart3 } from 'lucide-react';
import type { Player } from './types/database';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [activeMenu, setActiveMenu] = useState<'overview' | 'import'>('overview');
  const [managedPlayers, setManagedPlayers] = useState<Player[]>([]);
  const [activeManagedPlayerId, setActiveManagedPlayerId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const activeManagedPlayer = managedPlayers.find(p => p.player_id === activeManagedPlayerId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchManagedPlayers = async () => {
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
      const { data: players } = await supabase
        .from('players')
        .select('*')
        .in('player_id', pIds);

      if (players) {
        // Maintain the sort order from watchedRecords (most recent first)
        const sortedPlayers = pIds.map(id => players.find(p => p.player_id === id)).filter(Boolean) as Player[];
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
  };

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
      fetchManagedPlayers();

      // Listen for managed player registration events to refresh the dropdown
      const handleRefresh = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.playerType === 'managed') {
          fetchManagedPlayers();
        }
      };
      window.addEventListener('watched-players-changed', handleRefresh);
      return () => window.removeEventListener('watched-players-changed', handleRefresh);
    }
  }, [session]);

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

      {/* Sidebar */}
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
            onClick={() => {
              setActiveMenu('overview');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center px-4 py-3 rounded-lg font-medium transition-colors ${activeMenu === 'overview'
              ? 'bg-tennis-green-50 text-tennis-green-700'
              : 'text-gray-600 hover:bg-tennis-green-50 hover:text-tennis-green-700'
              }`}
          >
            <BarChart3 className="w-5 h-5 mr-3" />
            Overview & Charts
          </button>

          <button
            onClick={() => {
              setActiveMenu('import');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center px-4 py-3 rounded-lg font-medium transition-colors ${activeMenu === 'import'
              ? 'bg-tennis-green-50 text-tennis-green-700'
              : 'text-gray-600 hover:bg-tennis-green-50 hover:text-tennis-green-700'
              }`}
          >
            <Upload className="w-5 h-5 mr-3" />
            Import CSV Data
          </button>
        </nav>

        <div className="p-4 border-t border-tennis-green-100">
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center w-full px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-tennis-green-100 flex items-center justify-between px-4 lg:px-8 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-600 hover:bg-tennis-green-50 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-lg lg:text-xl font-semibold text-gray-800 truncate">
              {activeMenu === 'overview' ? 'Player Analytics' : 'Data Management'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm border border-tennis-green-200 bg-tennis-green-50 text-tennis-green-700 px-3 py-1 rounded-full font-medium">
              {session.user.email}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-8 z-10 relative">
          <div className="max-w-6xl mx-auto space-y-6">
            {activeMenu === 'import' && <DashboardOverview />}

            {activeMenu === 'overview' && (
              <div className="space-y-12">
                {/* Managed Player Selection Section */}
                <section className="glass-panel p-6 shadow-sm border-l-4 border-l-tennis-green-500">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-tennis-green-100 flex items-center justify-center text-tennis-green-700">
                        <Users size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">管理対象の選手を選択</h3>
                        <p className="text-sm text-gray-500">切り替えることで、それぞれの対戦相手を表示します</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <select
                        className="bg-white border border-tennis-green-200 text-gray-700 py-2 px-4 pr-8 rounded-lg outline-none focus:ring-2 focus:ring-tennis-green-500 appearance-none min-w-[200px]"
                        value={activeManagedPlayerId || ''}
                        onChange={(e) => setActiveManagedPlayerId(e.target.value)}
                        disabled={managedPlayers.length === 0}
                      >
                        {managedPlayers.length === 0 ? (
                          <option value="">登録選手なし</option>
                        ) : (
                          managedPlayers.map(p => (
                            <option key={p.player_id} value={p.player_id}>
                              {p.full_name || `${p.last_name} ${p.first_name}`} ({p.player_id})
                            </option>
                          ))
                        )}
                      </select>
                      <div className="pointer-events-none -ml-10 z-10 text-tennis-green-600">
                        ▼
                      </div>
                      <button
                        onClick={handleDeleteManagedPlayer}
                        disabled={!activeManagedPlayerId}
                        className="ml-2 p-2.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100 bg-white"
                        title="この管理選手を削除"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="flex justify-between items-end mb-4 border-b border-tennis-green-200 pb-2">
                    <h2 className="text-2xl font-bold text-tennis-green-900 flex items-center">
                      <UserCheck className="mr-2" /> 管理選手 (Managed Players)
                    </h2>
                  </div>
                  <MultiPlayerChart
                    playerType="managed"
                    title="管理選手の状況"
                    activeManagedPlayerId={activeManagedPlayerId}
                  />
                  <PlayerSearch
                    playerType="managed"
                    title="新しく管理選手を追加"
                    activeManagedPlayerId={activeManagedPlayerId}
                  />
                </section>

                {activeManagedPlayerId ? (
                  <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between items-end mb-4 border-b border-tennis-green-200 pb-2">
                      <h2 className="text-2xl font-bold text-tennis-green-900">
                        「{activeManagedPlayer?.full_name || activeManagedPlayerId}」の対戦相手 (Opponents)
                      </h2>
                    </div>
                    <div className="space-y-8">
                      <MultiPlayerChart
                        playerType="opponent"
                        title={`${activeManagedPlayer?.full_name || '選手'}の対戦相手の推移`}
                        activeManagedPlayerId={activeManagedPlayerId}
                      />
                    </div>
                    <PlayerSearch
                      playerType="opponent"
                      title="対戦相手を検索・登録"
                      activeManagedPlayerId={activeManagedPlayerId}
                    />
                  </section>
                ) : (
                  <div className="text-center py-20 bg-white/30 rounded-2xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-400">管理選手を登録または選択すると、ここに対戦相手の情報が表示されます。</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Decorative background for main area */}
        <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-tennis-green-100 to-transparent opacity-60 blur-3xl mix-blend-multiply"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-gradient-to-tr from-tennis-green-200 to-transparent opacity-40 blur-3xl mix-blend-multiply"></div>
        </div>
      </main>
    </div>
  );
}

export default App;
