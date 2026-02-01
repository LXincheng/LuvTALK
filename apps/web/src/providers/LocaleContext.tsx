/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Locale = 'zh' | 'en';

export const localeLabels: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
};

const translations = {
  zh: {
    appName: 'LuvTALK',
    appSubtitle: 'AI 语言导师',
    navChat: '对话',
    navFavorites: '收藏',
    navReview: '复习',
    navProfile: '我的',
    chatTitle: '与 AI 导师对话',
    immersiveMode: '沉浸模式',
    exitImmersive: '退出沉浸',
    recording: '正在录音...',
    placeholder: '输入文字或使用麦克风...',
    translation: '翻译',
    pronunciation: '发音评分',
    sessionInit: '会话初始化中...',
    sessionInitError: '无法初始化会话，请检查后端服务是否可用。',
    streamError: '会话流连接中断，请检查网络或服务状态。',
    streamParseError: '会话更新解析失败，请稍后重试。',
    sendError: '消息发送失败，请稍后再试。',
    voiceSending: '语音已发送，导师正在处理...',
    voiceWaiting: '语音已发送，等待导师回复。',
    voiceSendError: '语音发送失败，请重试。',
    voiceUnsupported: '当前浏览器不支持语音录制。',
    voicePermissionDenied: '麦克风权限获取失败，请检查浏览器设置。',
    voiceNoCapture: '未捕获到语音，请重试。',
    favoritesTitle: '收藏',
    favoritesSubtitle: '你的常用表达与关键词汇',
    favoritesEmptyTitle: '暂无收藏',
    favoritesEmptyHint: '在对话中保存表达或词汇',
    favoritesLoading: '正在加载收藏...',
    favoritesLoadError: '收藏列表加载失败，请稍后再试。',
    favoritesDeleteError: '删除失败，请稍后再试。',
    favoritesSaveError: '收藏保存失败，请稍后再试。',
    favoritesAdded: '收藏时间',
    favoritesCopy: '复制内容',
    favoritesRemove: '从收藏移除',
    favoritesCopyError: '复制失败，请手动选择文本。',
    favoritesClipboardUnsupported: '当前浏览器不支持一键复制。',
    reviewCompleteTitle: '做得很棒！',
    reviewCompleteSubtitle: '你已完成今日复习',
    reviewAgain: '再复习一次',
    reviewKnown: '已掌握',
    reviewPractice: '需练习',
    reviewNeedPractice: '需要练习',
    reviewKnowThis: '我已掌握',
    reviewCardLabel: '卡片',
    reviewTranslation: '翻译',
    reviewExample: '例句',
    reviewShow: '显示翻译',
    reviewHide: '隐藏翻译',
    reviewWordLabel: '词语 / 句子',
    reviewLoading: '正在加载今日复习...',
    reviewLoadError: '复习卡片加载失败，请稍后再试。',
    reviewEmptyTitle: '今日暂无复习卡片',
    reviewEmptyHint: '先在对话中收藏词汇或完成练习吧。',
    reviewSpeak: '听发音',
    reviewFeedbackError: '复习反馈提交失败，请稍后再试。',
    reviewTtsError: '语音合成失败，请稍后重试。',
    reviewTtsUnavailable: '语音合成暂不可用。',
    profileTitle: '学习档案',
    profileProgress: '学习进度',
    profileAchievements: '近期成就',
    profileEdit: '编辑资料',
    vocabExamples: '例句',
    vocabSave: '保存到收藏',
    vocabSaved: '已保存到收藏',
    learningLanguage: '学习语言',
    interfaceLanguage: '界面语言',
    themeDark: '深色模式',
    themeLight: '浅色模式',
  },
  en: {
    appName: 'LuvTALK',
    appSubtitle: 'AI Language Tutor',
    navChat: 'Chat',
    navFavorites: 'Favorites',
    navReview: 'Review',
    navProfile: 'Profile',
    chatTitle: 'Chat with AI Tutor',
    immersiveMode: 'Immersive Mode',
    exitImmersive: 'Exit Immersive',
    recording: 'Recording...',
    placeholder: 'Type a message or use the microphone...',
    translation: 'Translation',
    pronunciation: 'Pronunciation',
    sessionInit: 'Preparing your session...',
    sessionInitError: 'Unable to start session. Please check the backend.',
    streamError: 'Session stream disconnected. Please check the network.',
    streamParseError: 'Failed to parse live updates. Please retry later.',
    sendError: 'Failed to send message. Please try again.',
    voiceSending: 'Voice sent. Your tutor is processing it...',
    voiceWaiting: 'Voice sent. Waiting for tutor response.',
    voiceSendError: 'Voice send failed. Please retry.',
    voiceUnsupported: 'Voice recording is not supported in this browser.',
    voicePermissionDenied: 'Microphone permission denied. Please check settings.',
    voiceNoCapture: 'No voice captured. Please retry.',
    favoritesTitle: 'Favorites',
    favoritesSubtitle: 'Saved phrases and keywords',
    favoritesEmptyTitle: 'No favorites yet',
    favoritesEmptyHint: 'Save expressions or vocabulary from chat',
    favoritesLoading: 'Loading favorites...',
    favoritesLoadError: 'Failed to load favorites. Please retry.',
    favoritesDeleteError: 'Delete failed. Please retry.',
    favoritesSaveError: 'Save failed. Please retry.',
    favoritesAdded: 'Added',
    favoritesCopy: 'Copy content',
    favoritesRemove: 'Remove from favorites',
    favoritesCopyError: 'Copy failed. Please select text manually.',
    favoritesClipboardUnsupported: 'Clipboard API not available.',
    reviewCompleteTitle: 'Great job!',
    reviewCompleteSubtitle: "You've completed today's review",
    reviewAgain: 'Review Again',
    reviewKnown: 'Known',
    reviewPractice: 'Practice',
    reviewNeedPractice: 'Need Practice',
    reviewKnowThis: 'I Know This',
    reviewCardLabel: 'Card',
    reviewTranslation: 'Translation',
    reviewExample: 'Example',
    reviewShow: 'Show translation',
    reviewHide: 'Hide translation',
    reviewWordLabel: 'Word / Phrase',
    reviewLoading: 'Loading today’s review...',
    reviewLoadError: 'Failed to load review cards. Please retry.',
    reviewEmptyTitle: 'No review cards yet',
    reviewEmptyHint: 'Save vocabulary from chat or finish a practice round.',
    reviewSpeak: 'Listen',
    reviewFeedbackError: 'Failed to submit review feedback. Please retry.',
    reviewTtsError: 'Speech synthesis failed. Please retry.',
    reviewTtsUnavailable: 'Speech synthesis is unavailable right now.',
    profileTitle: 'Learning Profile',
    profileProgress: 'Learning Progress',
    profileAchievements: 'Recent Achievements',
    profileEdit: 'Edit Profile',
    vocabExamples: 'Examples',
    vocabSave: 'Save to Favorites',
    vocabSaved: 'Saved to Favorites',
    learningLanguage: 'Learning Language',
    interfaceLanguage: 'Interface Language',
    themeDark: 'Dark Mode',
    themeLight: 'Light Mode',
  },
} as const;

export type LocaleKey = keyof (typeof translations)['zh'];

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
