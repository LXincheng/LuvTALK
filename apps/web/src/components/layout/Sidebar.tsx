import { NavLink } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { navItems } from '../../constants/navigation';
import { useLocale } from '../../providers/LocaleContext';
import { useTheme } from '../../providers/ThemeContext';

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const { t, locale, setLocale } = useLocale();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="w-64 h-full glass-sidebar border-r border-slate-200 dark:border-slate-700 flex flex-col">
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <h1 className="text-2xl font-semibold text-indigo-600 dark:text-indigo-400">
          {t('appName')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('appSubtitle')}
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.id}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-5 h-5 ${
                      isActive
                        ? 'text-indigo-600 dark:text-indigo-300'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  />
                  <span className="font-medium">{t(item.labelKey)}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('interfaceLanguage')}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocale('zh')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                locale === 'zh'
                  ? 'glass-button text-white'
                  : 'bg-white/60 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              中文
            </button>
            <button
              onClick={() => setLocale('en')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                locale === 'en'
                  ? 'glass-button text-white'
                  : 'bg-white/60 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              English
            </button>
          </div>
        </div>

        <button
          onClick={toggleTheme}
          className="w-full glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-center justify-between text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
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

        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-semibold">
            JD
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              John Doe
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {locale === 'zh' ? '中级' : 'Intermediate'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
