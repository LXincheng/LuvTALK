import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import { navItems } from '../../constants/navigation';
import { useLocale } from '../../providers/LocaleContext';

export default function BottomTabBar() {
  const { t } = useLocale();
  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-sidebar border-t border-separator px-2 py-2 safe-area-inset-bottom z-40">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                `press-scale flex flex-col items-center gap-1 px-3 sm:px-4 py-2 rounded-xl transition-all ${
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
                      className={`w-5 h-5 sm:w-6 sm:h-6 ${
                        isActive ? 'text-primary' : 'text-label-tertiary'
                      }`}
                    />
                  </motion.div>
                  <span className="text-[10px] sm:text-xs font-medium">{t(item.labelKey)}</span>
                  {isActive && (
                    <motion.div
                      layoutId="tab-dot"
                      className="w-1 h-1 rounded-full bg-primary"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
