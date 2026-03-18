import { apiClient } from './apiClient';
import { buildConversationAccessHeaders } from './conversationService';
import type { SaveRealtimeTranscriptPayload } from '../types/realtime';

export function saveRealtimeTranscript(payload: SaveRealtimeTranscriptPayload) {
  return apiClient.postWithOptions<{ saved: number }, SaveRealtimeTranscriptPayload>(
    '/realtime/transcript',
    payload,
    { headers: buildConversationAccessHeaders(payload.conversationId) },
  );
}
