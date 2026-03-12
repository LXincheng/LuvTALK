/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import zh from '../locales/zh.json';
import en from '../locales/en.json';

export type Locale = 'zh' | 'en';

export const localeLabels: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
};

const translations = { zh, en } as const;

export type LocaleKey = keyof typeof zh;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: LocaleKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

const getInitialLocale = (): Locale => {
  if (typeof window === 'undefined') {
    return 'zh';
  }
  const stored = window.localStorage.getItem('locale') as Locale | null;
  if (stored === 'zh' || stored === 'en') {
    return stored;
  }
  return 'zh';
};

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);

  useEffect(() => {
    window.localStorage.setItem('locale', locale);
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: LocaleKey) => translations[locale][key],
    }),
    [locale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
}
