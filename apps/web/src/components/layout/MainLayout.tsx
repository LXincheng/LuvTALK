import { useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomTabBar from './BottomTabBar';
import Sidebar from './Sidebar';
import { navItems } from '../../constants/navigation';
import { useLocale } from '../../providers/LocaleContext';

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { t } = useLocale();
  const currentItem = useMemo(() => {
    return (
      navItems.find((item) => location.pathname.startsWith(item.path)) ??
      navItems[0]
    );
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden glass-sidebar border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6 text-slate-700 dark:text-slate-300" />
          </button>
          <h1 className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">
            {t(currentItem.labelKey)}
          </h1>
          <div className="w-10" />
        </header>

        <main className="flex-1 overflow-hidden pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      <div className="md:hidden">
        <BottomTabBar />
      </div>
    </div>
  );
}
