import { NavLink } from 'react-router-dom';
import { navItems } from '../../constants/navigation';
import { useLocale } from '../../providers/LocaleContext';

export default function BottomTabBar() {
  const { t } = useLocale();
  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-sidebar border-t border-slate-200 dark:border-slate-700 px-2 py-2 safe-area-inset-bottom">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-6 h-6 ${
                      isActive
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <span className="text-xs font-medium">{t(item.labelKey)}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
