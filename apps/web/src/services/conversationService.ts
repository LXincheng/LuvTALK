import { apiClient } from './apiClient';
import type {
  ConversationHistorySummary,
  ConversationSession,
  LanguageCode,
  VoiceOperationSnapshot,
  VoiceUploadResponse,
} from '../types/api';

export interface StartConversationPayload {
  scenarioId?: string;
  targetLanguage: LanguageCode;
  nativeLanguage?: LanguageCode;
}

export interface ResumeConversationPayload extends StartConversationPayload {
  conversationId?: string;
}

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
  );
}

export function archiveConversation(conversationId: string) {
  return apiClient.post<{ status: string }, Record<string, never>>(
    `/conversation/${conversationId}/archive`,
    {},
  );
}

export function sendConversationMessage(conversationId: string, message: string) {
  return apiClient.post<ConversationSession, { message: string }>(
    `/conversation/${conversationId}/message`,
    { message },
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
  );
}

export function fetchVoiceOperationStatus(
  conversationId: string,
  operationId: string,
) {
  return apiClient.get<VoiceOperationSnapshot>(
    `/conversation/${conversationId}/voice-status/${operationId}`,
  );
}

export function synthesizeConversationSpeech(
  conversationId: string,
  text: string,
  voice?: string,
) {
  return apiClient.post<{ audioUrl: string; fileName: string }, { text: string; voice?: string }>(
    `/conversation/${conversationId}/tts`,
    { text, voice },
  );
}
