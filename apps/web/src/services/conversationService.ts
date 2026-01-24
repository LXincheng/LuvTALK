import { apiClient } from './apiClient';
import type {
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

export function startConversation(payload: StartConversationPayload) {
  return apiClient.post<ConversationSession, StartConversationPayload>(
    '/conversation/session',
    payload,
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
