import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { navItems } from '../../constants/navigation';
import { useLocale } from '../../providers/LocaleContext';
import { useTheme } from '../../providers/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { fetchAchievementSummaryCached, type AchievementSummary } from '../../services/achievementService';
import { getDisplayName, getInitials, getUserMetaLine } from '../../utils/userProfile';

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const { t, locale, setLocale } = useLocale();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [summary, setSummary] = useState<AchievementSummary | null>(null);
  const userKey = user?.id ?? 'guest';
  const displayName = getDisplayName(user, t('profileGuest'), t('profileLearner'));
  const initials = getInitials(displayName);
  const metaLine = getUserMetaLine({
    user,
    summary,
    locale,
    guestLabel: t('profileGuestModeSimple'),
  });

  useEffect(() => {
    const { cached, fresh } = fetchAchievementSummaryCached(userKey);
    if (cached) {
      setSummary(cached);
    }
    fresh.then(setSummary).catch(() => {});
  }, [userKey]);

  return (
    <aside className="w-64 lg:w-72 h-full glass-sidebar border-r border-separator flex flex-col">
      <div className="p-6 border-b border-separator">
        <div className="flex items-center gap-3">
          <img
            src="/luvtalk-icon.svg"
            alt="LuvTALK"
            className="h-11 w-11 rounded-[14px]"
          />
          <div className="min-w-0">
            <h1 className="text-[1.06rem] font-semibold tracking-[-0.04em] text-label leading-none">
              LuvTALK
            </h1>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-label-tertiary">
              Live Language Studio
            </p>
          </div>
        </div>
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
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[#5856D6] text-sm font-semibold text-white">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-label truncate">
              {displayName}
            </p>
            <p className="text-xs text-label-tertiary truncate">
              {metaLine}
            </p>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}
