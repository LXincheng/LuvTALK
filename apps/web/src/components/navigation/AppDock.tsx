import { IonIcon } from '@ionic/react';
import { Link } from 'react-router-dom';
import './AppDock.css';

export interface DockItem {
  label: string;
  icon: string;
  href: string;
}

interface AppDockProps {
  items: DockItem[];
  active?: string;
}

const AppDock: React.FC<AppDockProps> = ({ items, active }) => {
  return (
    <nav className="app-dock" aria-label="Primary navigation">
      <div className="app-dock-shell">
        {items.map(item => (
          <Link
            key={item.label}
            to={item.href}
            aria-label={item.label}
            aria-current={active === item.href ? 'page' : undefined}
            className={`app-dock-button ${active === item.href ? 'app-dock-button-active' : ''}`}
          >
            <IonIcon icon={item.icon} />
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default AppDock;
