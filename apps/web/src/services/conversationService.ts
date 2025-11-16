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

export async function fetchConversation(conversationId: string) {
  return apiClient.get<ConversationSession>(`/conversation/${conversationId}`);
}

