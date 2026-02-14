export type RealtimeRole = 'user' | 'ai';

export interface RealtimeTranscriptEntry {
  role: RealtimeRole;
  text: string;
  timestamp: string;
}

export interface SaveRealtimeTranscriptPayload {
  conversationId: string;
  messages: RealtimeTranscriptEntry[];
}

export type RealtimeErrorCode =
  | 'UNSUPPORTED'
  | 'TOKEN_FAILED'
  | 'CONNECT_FAILED'
  | 'MEDIA_DENIED'
  | 'SAVE_FAILED'
  | 'TAKEN_OVER'
  | 'PERMISSION_DENIED'
  | 'SESSION_EXPIRED';
