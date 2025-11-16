import { IonIcon } from '@ionic/react';
import { Link, useLocation } from 'react-router-dom';
import './AppDock.css';
import { LocaleKey, useLocale } from '../../shared/i18n/LocaleProvider';

type DockLabelKey = Extract<LocaleKey, 'navConversation' | 'navFavorites'>;

export interface DockItem {
  labelKey: DockLabelKey;
  icon: string;
  href: string;
}

interface AppDockProps {
  items: DockItem[];
  active?: string;
}

const AppDock: React.FC<AppDockProps> = ({ items, active }) => {
  const location = useLocation();
  const { t } = useLocale();

  return (
    <nav className="app-dock" aria-label="Primary navigation">
      <div className="app-dock-shell">
        {items.map(item => {
          const isActive = (active ?? location.pathname) === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              aria-label={t(item.labelKey)}
              aria-current={isActive ? 'page' : undefined}
              className={`app-dock-button ${isActive ? 'app-dock-button-active' : ''}`}
            >
              <IonIcon icon={item.icon} />
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default AppDock;
