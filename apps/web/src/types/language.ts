export type LanguageCode = 'mandarin' | 'cantonese' | 'english';
export type UiLanguage = 'zh' | 'en';

export const LANGUAGE_LABELS: Record<UiLanguage, Record<LanguageCode, string>> = {
  zh: {
    mandarin: '普通话',
    cantonese: '粤语',
    english: '英语',
  },
  en: {
    mandarin: 'Mandarin',
    cantonese: 'Cantonese',
    english: 'English',
  },
};

export const LANGUAGE_SPEECH_VOICES: Record<LanguageCode, SpeechSynthesisUtterance['lang']> = {
  mandarin: 'zh-CN',
  cantonese: 'yue-Hant-HK',
  english: 'en-US',
};

export const UI_LANGUAGE_LABELS: Record<UiLanguage, string> = {
  zh: '中文',
  en: 'English',
};

export const UI_LANGUAGE_TO_NATIVE: Record<UiLanguage, LanguageCode> = {
  zh: 'mandarin',
  en: 'english',
};
