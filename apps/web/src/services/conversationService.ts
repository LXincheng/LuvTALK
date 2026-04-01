import { apiClient } from './apiClient';
import {
  CONVERSATION_ACCESS_KEYS_STORAGE_KEY,
  CONVERSATION_REPORT_CACHE_KEY,
} from '../constants/storage';
import type {
  ConversationHistorySummary,
  ConversationReportHistoryItem,
  ConversationReportPayload,
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

const readCachedReports = (): ConversationReportPayload[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(CONVERSATION_REPORT_CACHE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as ConversationReportPayload[] : [];
  } catch {
    return [];
  }
};

const writeCachedReports = (reports: ConversationReportPayload[]) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(
    CONVERSATION_REPORT_CACHE_KEY,
    JSON.stringify(reports),
  );
};

const toReportHistoryItem = (
  report: ConversationReportPayload,
): ConversationReportHistoryItem => ({
  id: report.id,
  conversationId: report.conversationId,
  createdAt: report.createdAt,
  updatedAt: report.updatedAt,
  targetLanguage: report.targetLanguage,
  nativeLanguage: report.nativeLanguage,
  sourceMode: report.sourceMode,
  voiceStyle: report.voiceStyle,
  reportLanguage: report.reportLanguage,
  headline: report.report.headline,
  overallSummary: report.report.overallSummary,
  averageScore: report.metrics.averageScore,
  durationMinutes: report.metrics.durationMinutes,
});

export const cacheConversationReport = (report: ConversationReportPayload) => {
  const existing = readCachedReports().filter(
    (item) =>
      item.id !== report.id && item.conversationId !== report.conversationId,
  );
  existing.unshift(report);
  existing.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  writeCachedReports(existing.slice(0, 10));
};

const getCachedConversationReport = (
  conversationId: string,
): ConversationReportPayload | null =>
  readCachedReports().find((item) => item.conversationId === conversationId) ?? null;

const getCachedConversationReportById = (
  reportId: string,
): ConversationReportPayload | null =>
  readCachedReports().find((item) => item.id === reportId) ?? null;

const getCachedConversationReportHistory = (): ConversationReportHistoryItem[] =>
  readCachedReports().map(toReportHistoryItem);

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

export function fetchConversationSummary(conversationId: string, locale?: string) {
  const params = locale ? `?locale=${locale}` : '';
  return apiClient.get<SessionSummaryPayload>(
    `/conversation/${conversationId}/summary${params}`,
    { headers: buildConversationAccessHeaders(conversationId) },
  );
}

export function fetchConversationReport(conversationId: string) {
  return apiClient.get<ConversationReportPayload | null>(
    `/conversation/${conversationId}/report`,
    { headers: buildConversationAccessHeaders(conversationId) },
  )
    .then((payload) => {
      if (payload) {
        cacheConversationReport(payload);
      }
      return payload;
    })
    .catch(() => getCachedConversationReport(conversationId));
}

export function generateConversationReport(
  conversationId: string,
  payload: {
    sourceMode?: 'immersive' | 'voice' | 'text';
    voiceStyle?: string;
    force?: boolean;
  } = {},
) {
  return apiClient.postWithOptions<
    ConversationReportPayload,
    {
      sourceMode?: 'immersive' | 'voice' | 'text';
      voiceStyle?: string;
      force?: boolean;
    }
  >(
    `/conversation/${conversationId}/report`,
    payload,
    { headers: buildConversationAccessHeaders(conversationId) },
  ).then((report) => {
    cacheConversationReport(report);
    return report;
  });
}

export function fetchConversationReportHistory() {
  return apiClient.get<ConversationReportHistoryItem[]>(
    '/conversation/reports/history',
  )
    .then((payload) => {
      const cached = getCachedConversationReportHistory();
      if (!payload.length && cached.length) {
        return cached;
      }
      return payload;
    })
    .catch(() => getCachedConversationReportHistory());
}

export function fetchConversationReportById(reportId: string) {
  return apiClient.get<ConversationReportPayload>(
    `/conversation/reports/${reportId}`,
  )
    .then((payload) => {
      cacheConversationReport(payload);
      return payload;
    })
    .catch(() => {
      const cached = getCachedConversationReportById(reportId);
      if (!cached) {
        throw new Error('report_not_found');
      }
      return cached;
    });
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
