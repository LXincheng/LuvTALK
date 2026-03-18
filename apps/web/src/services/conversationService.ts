import { apiClient } from './apiClient';
import type {
  ConversationHistorySummary,
  ConversationSession,
  LanguageCode,
  SessionSummaryPayload,
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

const CONVERSATION_ACCESS_KEYS_STORAGE_KEY = 'conversationAccessKeys';

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

export function fetchConversationById(conversationId: string) {
  return apiClient.get<ConversationSession>(
    `/conversation/${conversationId}`,
    { headers: buildConversationAccessHeaders(conversationId) },
  );
}

export function fetchConversationSummary(conversationId: string) {
  return apiClient.get<SessionSummaryPayload>(
    `/conversation/${conversationId}/summary`,
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

export function updateConversationPreferences(
  conversationId: string,
  payload: { memoryEnabled?: boolean },
) {
  return apiClient.postWithOptions<ConversationSession, { memoryEnabled?: boolean }>(
    `/conversation/${conversationId}/preferences`,
    payload,
    { headers: buildConversationAccessHeaders(conversationId) },
  );
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
) {
  return apiClient.postWithOptions<{ audioUrl: string; fileName: string }, { text: string; voice?: string }>(
    `/conversation/${conversationId}/tts`,
    { text, voice },
    { headers: buildConversationAccessHeaders(conversationId) },
  ).then((payload) => ({
    ...payload,
    audioUrl: withConversationAccessQuery(payload.audioUrl, conversationId),
  }));
}
