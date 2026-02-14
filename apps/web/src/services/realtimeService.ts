import { apiClient } from './apiClient';
import type { SaveRealtimeTranscriptPayload } from '../types/realtime';

export function saveRealtimeTranscript(payload: SaveRealtimeTranscriptPayload) {
  return apiClient.post<{ saved: number }, SaveRealtimeTranscriptPayload>(
    '/realtime/transcript',
    payload,
  );
}
