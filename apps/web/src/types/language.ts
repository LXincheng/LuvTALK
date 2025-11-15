export type LanguageCode = 'mandarin' | 'cantonese' | 'english';

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  mandarin: '普通话',
  cantonese: '粤语（繁）',
  english: 'English',
};

export const LANGUAGE_SPEECH_VOICES: Record<LanguageCode, SpeechSynthesisUtterance['lang']> = {
  mandarin: 'zh-CN',
  cantonese: 'yue-Hant-HK',
  english: 'en-US',
};
