import {
  TTS_SPEED_STORAGE_KEY,
  TTS_VOICE_BY_LANGUAGE_STORAGE_KEY,
} from '../constants/storage';
import { getDefaultTtsVoice, isTtsVoiceSupported } from '../config/voice';
import type { LanguageCode } from '../types/api';

export type TtsSpeed = 'slow' | 'normal' | 'fast';

const readVoiceMap = (): Partial<Record<LanguageCode, string>> => {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(TTS_VOICE_BY_LANGUAGE_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Partial<Record<LanguageCode, string>>)
      : {};
  } catch {
    return {};
  }
};

const writeVoiceMap = (value: Partial<Record<LanguageCode, string>>) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(
    TTS_VOICE_BY_LANGUAGE_STORAGE_KEY,
    JSON.stringify(value),
  );
};

export const getStoredTtsVoice = (language: LanguageCode): string => {
  if (typeof window === 'undefined') {
    return getDefaultTtsVoice(language);
  }

  const stored = readVoiceMap()[language];
  if (isTtsVoiceSupported(language, stored)) {
    return stored;
  }

  return getDefaultTtsVoice(language);
};

export const setStoredTtsVoice = (
  language: LanguageCode,
  voice: string,
) => {
  if (typeof window === 'undefined' || !isTtsVoiceSupported(language, voice)) {
    return;
  }
  const next = readVoiceMap();
  next[language] = voice;
  writeVoiceMap(next);
};

export const getStoredTtsSpeed = (): TtsSpeed => {
  if (typeof window === 'undefined') {
    return 'normal';
  }
  const stored = window.localStorage.getItem(TTS_SPEED_STORAGE_KEY);
  return stored === 'slow' || stored === 'fast' ? stored : 'normal';
};

export const setStoredTtsSpeed = (speed: TtsSpeed) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(TTS_SPEED_STORAGE_KEY, speed);
};
