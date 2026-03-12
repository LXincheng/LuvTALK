import { NavLink } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { navItems } from '../../constants/navigation';
import { useLocale } from '../../providers/LocaleContext';
import { useTheme } from '../../providers/ThemeContext';
import { useAuth } from '../../hooks/useAuth';

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const { t, locale, setLocale } = useLocale();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const isGuest = user?.app_metadata?.provider === 'anonymous';
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    user?.phone ||
    (isGuest ? t('profileGuest') : t('profileLearner'));
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <aside className="w-64 lg:w-72 h-full glass-sidebar border-r border-separator flex flex-col">
      <div className="p-6 border-b border-separator">
        <h1 className="text-2xl font-semibold text-primary">
          {t('appName')}
        </h1>
        <p className="text-sm text-label-secondary mt-1">
          {t('appSubtitle')}
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-[var(--color-primary-soft)] text-primary'
                    : 'text-label-secondary hover:bg-fill-secondary'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 ${
                      isActive ? 'text-primary' : 'text-label-tertiary'
                    }`}
                  />
                  <span className="font-medium truncate">{t(item.labelKey)}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-separator space-y-3">
        <div className="glass-card rounded-xl p-3 space-y-2">
          <p className="text-xs text-label-tertiary">
            {t('interfaceLanguage')}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocale('zh')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                locale === 'zh'
                  ? 'glass-button text-white'
                  : 'bg-fill-secondary text-label-secondary hover:bg-fill'
              }`}
            >
              中文
            </button>
            <button
              onClick={() => setLocale('en')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                locale === 'en'
                  ? 'glass-button text-white'
                  : 'bg-fill-secondary text-label-secondary hover:bg-fill'
              }`}
            >
              English
            </button>
          </div>
        </div>

        <button
          onClick={toggleTheme}
          className="w-full glass-card rounded-xl p-3 flex items-center justify-between text-label-secondary hover:bg-fill-secondary transition-colors"
        >
          <span className="text-sm font-medium">
            {theme === 'dark' ? t('themeDark') : t('themeLight')}
          </span>
          {theme === 'dark' ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4" />
          )}
        </button>

        <NavLink
          to="/profile"
          onClick={onNavigate}
          className="flex items-center gap-3 p-3 rounded-xl hover:bg-fill-secondary transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[#5856D6] flex items-center justify-center text-white font-semibold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-label truncate">
              {displayName}
            </p>
            <p className="text-xs text-label-tertiary truncate">
              {isGuest ? t('profileGuestMode') : t('profileLearningStatus')}
            </p>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}