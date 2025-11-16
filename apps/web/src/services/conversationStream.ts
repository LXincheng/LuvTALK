import { ConversationSession } from '../types/api';
import { API_BASE_URL } from './apiClient';

export type ConversationStream = EventSource;

export const createConversationStream = (
  sessionId: string,
  onUpdate: (session: ConversationSession) => void,
): ConversationStream | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const source = new EventSource(`${API_BASE_URL}/conversation/${sessionId}/events`);
  source.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as ConversationSession;
      onUpdate(payload);
    } catch (error) {
      console.warn('Failed to parse conversation stream payload', error);
    }
  };
  source.onerror = (event) => {
    console.warn('Conversation stream error', event);
  };

  return source;
};
