import { apiClient } from './apiClient';
import {
  ACTIVE_CONVERSATION_BY_LANGUAGE_STORAGE_KEY,
  CONVERSATION_ACCESS_KEYS_STORAGE_KEY,
  CONVERSATION_IDS_STORAGE_KEY,
} from '../constants/storage';
import type {
  ConversationHistorySummary,
  ConversationSession,
  LanguageCode,
  ScenarioFeedbackPayload,
  ScenarioHintPayload,
  SessionSummaryPayload,
  VoiceCatalogItem,
  VoiceOperationSnapshot,
  VoiceUploadResponse,
} from '../types/api';
import type { ChatMode } from '../types/chat';

export interface StartConversationPayload {
  scenarioId?: string;
  targetLanguage: LanguageCode;
  nativeLanguage?: LanguageCode;
}

export interface ResumeConversationPayload extends StartConversationPayload {
  conversationId?: string;
}

export const MAX_STORED_CONVERSATIONS = 10;

const readStoredConversationAccessKeys = (): Record<string, string> => {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(CONVERSATION_ACCESS_KEYS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
};

const writeStoredConversationAccessKeys = (value: Record<string, string>) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(
    CONVERSATION_ACCESS_KEYS_STORAGE_KEY,
    JSON.stringify(value),
  );
};

const readStoredConversationIds = (): string[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(CONVERSATION_IDS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
};

const writeStoredConversationIds = (ids: string[]) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(
    CONVERSATION_IDS_STORAGE_KEY,
    JSON.stringify(ids.slice(0, MAX_STORED_CONVERSATIONS)),
  );
};

type ActiveConversationByLanguage = Partial<Record<LanguageCode, string>>;

const isLanguageCode = (value: unknown): value is LanguageCode =>
  value === 'cantonese' || value === 'mandarin' || value === 'english';

const readStoredActiveConversationByLanguage = (): ActiveConversationByLanguage => {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(ACTIVE_CONVERSATION_BY_LANGUAGE_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    const next: ActiveConversationByLanguage = {};
    for (const [language, conversationId] of Object.entries(parsed)) {
      if (isLanguageCode(language) && typeof conversationId === 'string' && conversationId.trim()) {
        next[language] = conversationId;
      }
    }
    return next;
  } catch {
    return {};
  }
};

const writeStoredActiveConversationByLanguage = (
  value: ActiveConversationByLanguage,
) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(
    ACTIVE_CONVERSATION_BY_LANGUAGE_STORAGE_KEY,
    JSON.stringify(value),
  );
};

export const getStoredConversationAccessKey = (
  conversationId: string,
): string | undefined => {
  const normalized = readStoredConversationAccessKeys()[conversationId]?.trim();
  return normalized || undefined;
};

export const storeConversationAccessKey = (
  conversationId: string,
  accessKey?: string,
) => {
  if (!conversationId.trim() || !accessKey?.trim()) {
    return;
  }
  const next = readStoredConversationAccessKeys();
  next[conversationId] = accessKey.trim();
  writeStoredConversationAccessKeys(next);
};

export const getStoredConversationIds = (): string[] => readStoredConversationIds();

export const trackConversationId = (conversationId: string) => {
  if (!conversationId.trim()) {
    return;
  }
  const next = readStoredConversationIds().filter((item) => item !== conversationId);
  next.unshift(conversationId);
  writeStoredConversationIds(next);
};

export const getStoredActiveConversationIdByLanguage = (
  language: LanguageCode,
): string | undefined => readStoredActiveConversationByLanguage()[language];

export const storeActiveConversationIdByLanguage = (
  language: LanguageCode,
  conversationId: string,
) => {
  if (!conversationId.trim()) {
    return;
  }
  const next = readStoredActiveConversationByLanguage();
  next[language] = conversationId;
  writeStoredActiveConversationByLanguage(next);
};

export const removeConversationPersistence = (
  conversationId: string,
  targetLanguage?: LanguageCode,
) => {
  if (typeof window === 'undefined' || !conversationId.trim()) {
    return;
  }

  const accessKeys = readStoredConversationAccessKeys();
  if (accessKeys[conversationId]) {
    delete accessKeys[conversationId];
    writeStoredConversationAccessKeys(accessKeys);
  }

  writeStoredConversationIds(
    readStoredConversationIds().filter((item) => item !== conversationId),
  );

  if (window.localStorage.getItem('activeConversationId') === conversationId) {
    window.localStorage.removeItem('activeConversationId');
  }

  const activeByLanguage = readStoredActiveConversationByLanguage();
  for (const [language, activeId] of Object.entries(activeByLanguage)) {
    if (activeId !== conversationId) {
      continue;
    }
    if (!targetLanguage || language === targetLanguage) {
      delete activeByLanguage[language as LanguageCode];
    }
  }
  writeStoredActiveConversationByLanguage(activeByLanguage);
};

export const buildConversationAccessHeaders = (
  conversationId: string,
): Record<string, string> => {
  const accessKey = getStoredConversationAccessKey(conversationId);
  return accessKey ? { 'X-Conversation-Key': accessKey } : {};
};

export const withConversationAccessQuery = (
  value: string,
  conversationId: string,
): string => {
  const accessKey = getStoredConversationAccessKey(conversationId);
  if (!accessKey) {
    return value;
  }
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const url = new URL(value, base);
  url.searchParams.set('conversationKey', accessKey);
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return url.toString();
  }
  return `${url.pathname}${url.search}${url.hash}`;
};

export function startConversation(payload: StartConversationPayload) {
  return apiClient.post<ConversationSession, StartConversationPayload>(
    '/conversation/session',
    payload,
  );
}

export function resumeConversation(payload: ResumeConversationPayload) {
  return apiClient.post<ConversationSession, ResumeConversationPayload>(
    '/conversation/resume',
    payload,
  );
}

export function fetchConversationHistory(ids?: string[]) {
  return apiClient.post<ConversationHistorySummary[], { ids?: string[] }>(
    '/conversation/history',
    { ids },
  );
}

export function deleteConversation(conversationId: string) {
  return apiClient.delete<{ status: string }>(
    `/conversation/${conversationId}`,
    { headers: buildConversationAccessHeaders(conversationId) },
  );
}

export function fetchConversationById(conversationId: string) {
  return apiClient.get<ConversationSession>(
    `/conversation/${conversationId}`,
    { headers: buildConversationAccessHeaders(conversationId) },
  );
}

export function fetchConversationSummary(conversationId: string, locale?: string) {
  const params = locale ? `?locale=${locale}` : '';
  return apiClient.get<SessionSummaryPayload>(
    `/conversation/${conversationId}/summary${params}`,
    { headers: buildConversationAccessHeaders(conversationId) },
  );
}

export function archiveConversation(conversationId: string) {
  return apiClient.postWithOptions<{ status: string }, Record<string, never>>(
    `/conversation/${conversationId}/archive`,
    {},
    { headers: buildConversationAccessHeaders(conversationId) },
  );
}

const mapChatModeToTutorMode = (
  chatMode?: ChatMode,
): 'text' | 'voice' | 'immersive' => {
  if (chatMode === 'immersive') {
    return 'immersive';
  }
  if (chatMode === 'text') {
    return 'text';
  }
  return 'voice';
};

export function sendConversationMessage(
  conversationId: string,
  message: string,
  chatMode?: ChatMode,
) {
  return apiClient.postWithOptions<
    ConversationSession,
    { message: string; mode: 'text' | 'voice' | 'immersive' }
  >(
    `/conversation/${conversationId}/message`,
    { message, mode: mapChatModeToTutorMode(chatMode) },
    { headers: buildConversationAccessHeaders(conversationId) },
  );
}

export function fetchVoiceConfig() {
  return apiClient.get<Record<LanguageCode, VoiceCatalogItem>>('/conversation/voice-config');
}

export function uploadConversationVoice(conversationId: string, audio: Blob) {
  const mimeType = audio.type.split(';')[0].toLowerCase();
  const fileName = (() => {
    if (mimeType.includes('webm')) {
      return 'voice-message.webm';
    }
    if (mimeType.includes('mpeg')) {
      return 'voice-message.mp3';
    }
    if (mimeType.includes('wav')) {
      return 'voice-message.wav';
    }
    if (mimeType.includes('mp4')) {
      return 'voice-message.mp4';
    }
    if (mimeType.includes('m4a')) {
      return 'voice-message.m4a';
    }
    return 'voice-message.bin';
  })();
  const formData = new FormData();
  formData.append('audio', audio, fileName);
  return apiClient.postForm<VoiceUploadResponse>(
    `/conversation/${conversationId}/voice`,
    formData,
    { headers: buildConversationAccessHeaders(conversationId) },
  );
}

export function sendConversationImageMessage(
  conversationId: string,
  image: File,
  message?: string,
) {
  const formData = new FormData();
  formData.append('image', image, image.name || 'image-upload.jpg');
  if (message?.trim()) {
    formData.append('message', message.trim());
  }
  return apiClient.postForm<ConversationSession>(
    `/conversation/${conversationId}/image-message`,
    formData,
    { headers: buildConversationAccessHeaders(conversationId) },
  );
}

export function fetchVoiceOperationStatus(
  conversationId: string,
  operationId: string,
) {
  return apiClient.get<VoiceOperationSnapshot>(
    `/conversation/${conversationId}/voice-status/${operationId}`,
    { headers: buildConversationAccessHeaders(conversationId) },
  );
}

export function synthesizeConversationSpeech(
  conversationId: string,
  text: string,
  voice?: string,
  speed?: 'slow' | 'normal' | 'fast',
) {
  return apiClient.postWithOptions<
    { audioUrl: string; fileName: string },
    { text: string; voice?: string; speed?: 'slow' | 'normal' | 'fast' }
  >(
    `/conversation/${conversationId}/tts`,
    { text, voice, speed },
    { headers: buildConversationAccessHeaders(conversationId) },
  ).then((payload) => ({
    ...payload,
    audioUrl: withConversationAccessQuery(payload.audioUrl, conversationId),
  }));
}

export function generateScenarioHint(
  conversationId: string,
  kind: 'hint' | 'nudge',
) {
  return apiClient.postWithOptions<
    ScenarioHintPayload,
    { kind: 'hint' | 'nudge' }
  >(
    `/conversation/${conversationId}/hint`,
    { kind },
    { headers: buildConversationAccessHeaders(conversationId) },
  );
}

export function generateScenarioFeedback(
  conversationId: string,
  payload: { force?: boolean } = {},
) {
  return apiClient.postWithOptions<
    ScenarioFeedbackPayload,
    { force?: boolean }
  >(
    `/conversation/${conversationId}/scenario-feedback`,
    payload,
    { headers: buildConversationAccessHeaders(conversationId) },
  );
}
