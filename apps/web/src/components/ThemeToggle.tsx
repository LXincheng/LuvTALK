import React, { useMemo } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { moon, sunny } from 'ionicons/icons';
import { useTheme } from '../hooks/useTheme';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const isBrowser = typeof window !== 'undefined';

  const isDark = useMemo(() => {
    if (!isBrowser) return theme === 'dark';
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return theme === 'dark';
  }, [theme, isBrowser]);

  return (
    <IonButton onClick={toggleTheme} fill="clear" color="dark">
      <IonIcon slot="icon-only" icon={isDark ? sunny : moon} />
    </IonButton>
  );
};

export default ThemeToggle;
