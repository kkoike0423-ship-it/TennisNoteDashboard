import { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import Auth from './components/Auth';
import DashboardOverview from './components/DashboardOverview';
import PlayerSearch from './components/PlayerSearch';
import MultiPlayerChart from './components/MultiPlayerChart';
import { LogOut, Upload, BarChart3 } from 'lucide-react';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [activeMenu, setActiveMenu] = useState<'overview' | 'import'>('overview');

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

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-tennis-green-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-tennis-green-100 flex flex-col transition-all z-20">
        <div className="h-16 flex items-center px-6 border-b border-tennis-green-100">
          <div className="w-8 h-8 bg-tennis-green-500 rounded-lg flex items-center justify-center mr-3">
            <span className="text-white font-bold text-sm">TN</span>
          </div>
          <span className="font-bold text-tennis-green-900 text-lg">Dashboard</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <button
            onClick={() => setActiveMenu('overview')}
            className={`w-full flex items-center px-4 py-3 rounded-lg font-medium transition-colors ${activeMenu === 'overview'
              ? 'bg-tennis-green-50 text-tennis-green-700'
              : 'text-gray-600 hover:bg-tennis-green-50 hover:text-tennis-green-700'
              }`}
          >
            <BarChart3 className="w-5 h-5 mr-3" />
            Overview & Charts
          </button>

          <button
            onClick={() => setActiveMenu('import')}
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
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-tennis-green-100 flex items-center justify-between px-8 z-10">
          <h2 className="text-xl font-semibold text-gray-800">
            {activeMenu === 'overview' ? 'Player Analytics' : 'Data Management'}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm border border-tennis-green-200 bg-tennis-green-50 text-tennis-green-700 px-3 py-1 rounded-full font-medium">
              {session.user.email}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 z-10 relative">
          <div className="max-w-6xl mx-auto space-y-6">
            {activeMenu === 'import' && <DashboardOverview />}

            {activeMenu === 'overview' && (
              <div className="space-y-12">
                <section>
                  <h2 className="text-2xl font-bold text-tennis-green-900 mb-4 border-b border-tennis-green-200 pb-2">管理選手 (Managed Players)</h2>
                  <MultiPlayerChart playerType="managed" title="管理選手の状況" />
                  <PlayerSearch playerType="managed" title="管理選手を検索・登録" />
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-tennis-green-900 mb-4 border-b border-tennis-green-200 pb-2">対戦相手 (Opponents)</h2>
                  <MultiPlayerChart playerType="opponent" title="対戦相手の状況" />
                  <PlayerSearch playerType="opponent" title="対戦相手を検索・登録" />
                </section>
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
