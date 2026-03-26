import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import { navItems } from '../../constants/navigation';
import { useLocale } from '../../providers/LocaleContext';

export default function BottomTabBar() {
  const { t } = useLocale();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-separator glass-sidebar px-2 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.18rem)]">
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                `press-scale relative flex h-11 min-w-[4.1rem] flex-col items-center justify-center gap-[2px] px-2.5 sm:px-3 rounded-[16px] transition-all ${
                  isActive
                    ? 'text-primary'
                    : 'text-label-tertiary'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <motion.div
                    animate={isActive ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                    transition={{ duration: 0.25 }}
                  >
                    <Icon
                      className={`h-5 w-5 ${
                        isActive ? 'text-primary' : 'text-label-tertiary'
                      }`}
                    />
                  </motion.div>
                  <span className="text-[10px] font-medium leading-none">{t(item.labelKey)}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
