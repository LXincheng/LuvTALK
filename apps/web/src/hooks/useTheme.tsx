import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const applyTheme = (theme: Theme) => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  const newThemeIsDark = theme === 'system' ? prefersDark.matches : theme === 'dark';
  document.body.classList.toggle('ion-palette-dark', newThemeIsDark);
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('theme', theme);

    const mediaQueryListener = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        document.body.classList.toggle('ion-palette-dark', e.matches);
      }
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', mediaQueryListener);
    return () => mediaQuery.removeEventListener('change', mediaQueryListener);
  }, [theme]);

  const toggleTheme = () => {
    if (theme === 'light') {
      setThemeState('dark');
    } else if (theme === 'dark') {
      setThemeState('light');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setThemeState(prefersDark ? 'light' : 'dark');
    }
  };

  const contextValue = useMemo(() => ({ theme, setTheme: setThemeState, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};