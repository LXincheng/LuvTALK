import { ConversationSession } from '../types/api';
import { LanguageCode } from '../types/language';
import { apiClient } from './apiClient';

export interface StartConversationPayload {
  scenarioId?: string;
  targetLanguage: LanguageCode;
  nativeLanguage?: LanguageCode;
}

export async function startConversation(payload: StartConversationPayload) {
  return apiClient.post<ConversationSession, StartConversationPayload>('/conversation/session', payload);
}

export async function sendConversationMessage(conversationId: string, message: string) {
  return apiClient.post<ConversationSession, { message: string }>(
    `/conversation/${conversationId}/message`,
    {
      message,
    },
  );
}

export interface VoiceUploadResponse {
  operationId: string;
  status: string;
}

const AUDIO_EXTENSION_MAP: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/webm": "webm",
  "video/webm": "webm",
};

export async function uploadConversationVoice(conversationId: string, audio: Blob) {
  const formData = new FormData();
  const extension =
    AUDIO_EXTENSION_MAP[audio.type as keyof typeof AUDIO_EXTENSION_MAP] ?? 'webm';
  formData.append('audio', audio, `voice-${Date.now()}.${extension}`);
  return apiClient.postForm<VoiceUploadResponse>(`/conversation/${conversationId}/voice`, formData);
}

export interface TtsResponse {
  audioUrl: string;
  fileName: string;
}

export async function synthesizeTutorSpeech(
  conversationId: string,
  payload: { text: string; voice?: string },
) {
  return apiClient.post<TtsResponse, { text: string; voice?: string }>(
    `/conversation/${conversationId}/tts`,
    payload,
  );
}

export async function fetchConversation(conversationId: string) {
  return apiClient.get<ConversationSession>(`/conversation/${conversationId}`);
}
