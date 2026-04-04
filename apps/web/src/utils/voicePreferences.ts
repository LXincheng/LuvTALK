import {
  REALTIME_VOICE_BY_LANGUAGE_STORAGE_KEY,
  REALTIME_VOICE_STORAGE_KEY,
  TTS_SPEED_STORAGE_KEY,
  TTS_VOICE_BY_LANGUAGE_STORAGE_KEY,
} from '../constants/storage';
import { DEFAULT_TTS_SPEED } from '../constants/ui';
import {
  getDefaultImmersiveVoice,
  getDefaultTtsVoice,
  isTtsVoiceSupported,
} from '../config/voice';
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

const readRealtimeVoiceMap = (): Partial<Record<LanguageCode, string>> => {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(REALTIME_VOICE_BY_LANGUAGE_STORAGE_KEY);
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

const writeRealtimeVoiceMap = (
  value: Partial<Record<LanguageCode, string>>,
) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(
    REALTIME_VOICE_BY_LANGUAGE_STORAGE_KEY,
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

export const getStoredRealtimeVoice = (language: LanguageCode): string => {
  if (typeof window === 'undefined') {
    return getDefaultImmersiveVoice(language);
  }

  const mapped = readRealtimeVoiceMap()[language];
  if (isTtsVoiceSupported(language, mapped)) {
    return mapped;
  }

  const legacy = window.localStorage.getItem(REALTIME_VOICE_STORAGE_KEY);
  if (isTtsVoiceSupported(language, legacy)) {
    return legacy;
  }

  return getDefaultImmersiveVoice(language);
};

export const setStoredRealtimeVoice = (
  language: LanguageCode,
  voice: string,
) => {
  if (typeof window === 'undefined' || !isTtsVoiceSupported(language, voice)) {
    return;
  }
  const next = readRealtimeVoiceMap();
  next[language] = voice;
  writeRealtimeVoiceMap(next);
  window.localStorage.setItem(REALTIME_VOICE_STORAGE_KEY, voice);
};

export const getStoredTtsSpeed = (): TtsSpeed => {
  if (typeof window === 'undefined') {
    return DEFAULT_TTS_SPEED;
  }
  const stored = window.localStorage.getItem(TTS_SPEED_STORAGE_KEY);
  return stored === 'slow' || stored === 'normal' || stored === 'fast'
    ? stored
    : DEFAULT_TTS_SPEED;
};

export const setStoredTtsSpeed = (speed: TtsSpeed) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(TTS_SPEED_STORAGE_KEY, speed);
};
