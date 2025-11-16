import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type UiLanguage = 'zh' | 'en';

const STORAGE_KEY = 'luvtalk-ui-language';
const FALLBACK_LOCALE: UiLanguage = 'zh';

const translations = {
  zh: {
    localeNameZh: '简体中文',
    localeNameEn: 'English',
    actionSwitchUiLanguage: '切换界面语言',
    navConversation: 'AI 对话',
    navFavorites: '收藏夹',
    conversationScenarioHeading: '练习场景',
    conversationScenarioAria: '选择练习场景',
    conversationLanguageHeading: '学习语言',
    conversationLanguageAria: '选择想要练习的语言',
    conversationUiLanguageLabel: '界面语言',
    conversationLoading: 'AI 正在准备场景...',
    conversationCoachScore: '评分',
    conversationFavoriteButton: '收藏此内容',
    conversationInputPlaceholder: '输入或按住语音按钮开始练习',
    conversationMicSeedText: '我想练习点餐对话',
    favoritesTitle: '收藏夹',
    favoritesHeroLabel: '学习资产',
    favoritesHeroDescription: '收藏的文化提示、句型和语音片段都会保存在这里。',
    favoritesLoading: '正在同步收藏内容...',
    favoritesEmptyTitle: '点击 AI 回复旁的书签即可收藏',
    favoritesEmptyDescription: '文化解释、语音片段都会自动同步到这里。',
    favoritesRemoveButton: '移除此收藏',
    favoriteTypePhrase: '语音片段',
    favoriteTypeCultural: '文化提示',
    favoriteTypeVocabulary: '词汇',
    favoriteTypeScenario: '场景灵感',
    labelLanguage: '语言',
    labelScenario: '场景',
  },
  en: {
    localeNameZh: 'Chinese',
    localeNameEn: 'English',
    actionSwitchUiLanguage: 'Switch interface language',
    navConversation: 'AI Tutor',
    navFavorites: 'Favorites',
    conversationScenarioHeading: 'Practice scenario',
    conversationScenarioAria: 'Pick a practice scenario',
    conversationLanguageHeading: 'Learning language',
    conversationLanguageAria: 'Choose the language you want to learn',
    conversationUiLanguageLabel: 'Interface language',
    conversationLoading: 'Preparing your tutor session...',
    conversationCoachScore: 'Score',
    conversationFavoriteButton: 'Save to favorites',
    conversationInputPlaceholder: 'Type or hold the mic to practice',
    conversationMicSeedText: 'I want to practice ordering food',
    favoritesTitle: 'Favorites',
    favoritesHeroLabel: 'Learning assets',
    favoritesHeroDescription: 'Saved culture tips, phrases, and clips live here.',
    favoritesLoading: 'Syncing your favorites...',
    favoritesEmptyTitle: 'Tap the bookmark near any AI reply to save it',
    favoritesEmptyDescription: 'Culture notes and voice clips will appear here automatically.',
    favoritesRemoveButton: 'Remove this favorite',
    favoriteTypePhrase: 'Speech pattern',
    favoriteTypeCultural: 'Culture tip',
    favoriteTypeVocabulary: 'Vocabulary',
    favoriteTypeScenario: 'Scenario idea',
    labelLanguage: 'Language',
    labelScenario: 'Scenario',
  },
} as const;

type TranslationMap = typeof translations;
export type LocaleKey = keyof TranslationMap['zh'];

interface LocaleContextValue {
  uiLanguage: UiLanguage;
  setUiLanguage: (language: UiLanguage) => void;
  t: (key: LocaleKey, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

const formatMessage = (template: string, params?: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = params?.[token];
    return value === undefined ? '' : String(value);
  });

const resolveInitialLocale = (): UiLanguage => {
  if (typeof window === 'undefined') {
    return FALLBACK_LOCALE;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY) as UiLanguage | null;
  if (stored === 'zh' || stored === 'en') {
    return stored;
  }

  const prefersZh = window.navigator.language?.toLowerCase().startsWith('zh');
  return prefersZh ? 'zh' : 'en';
};

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const [uiLanguage, setUiLanguageState] = useState<UiLanguage>(resolveInitialLocale);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, uiLanguage);
      document.documentElement.lang = uiLanguage === 'zh' ? 'zh-Hans' : 'en';
    }
  }, [uiLanguage]);

  const setUiLanguage = useCallback((language: UiLanguage) => {
    setUiLanguageState(language);
  }, []);

  const t = useCallback(
    (key: LocaleKey, params?: Record<string, string | number>) => {
      const template = translations[uiLanguage][key] ?? translations[FALLBACK_LOCALE][key];
      return formatMessage(template, params);
    },
    [uiLanguage],
  );

  const value = useMemo(
    () => ({
      uiLanguage,
      setUiLanguage,
      t,
    }),
    [uiLanguage, setUiLanguage, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = (): LocaleContextValue => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
};
