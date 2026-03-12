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
    <div className="flex h-screen bg-surface overflow-hidden">
      <div className="hidden md:block flex-shrink-0">
        <Sidebar />
      </div>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 will-change-transform animate-in slide-in-from-bottom-4">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="md:hidden glass-sidebar border-b border-separator px-4 py-3 flex items-center justify-between safe-area-inset-top flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-fill rounded-lg transition-colors flex-shrink-0"
          >
            <Menu className="w-6 h-6 text-label-secondary" />
          </button>
          <h1 className="text-lg font-semibold text-primary truncate mx-2">
            {t(currentItem.labelKey)}
          </h1>
          <div className="w-10 flex-shrink-0" />
        </header>

        <main className="flex-1 overflow-hidden pb-[var(--bottom-bar-h)] md:pb-0">
          <Outlet />
        </main>
      </div>

      <div className="md:hidden">
        <BottomTabBar />
      </div>
    </div>
  );
}
