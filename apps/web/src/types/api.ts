import { LanguageCode } from './language';

export interface ConversationMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  language: LanguageCode;
  createdAt: string;
  senderName?: string;
  avatar?: string;
  meta?: {
    score?: number;
    translation?: string;
    audioUrl?: string;
  };
}

export interface ConversationCoachNote {
  correction?: string;
  cultureNote?: string;
  associativePhrases: string[];
  overallScore: number;
}

export interface ConversationSession {
  id: string;
  scenarioId: string;
  targetLanguage: LanguageCode;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
  coach?: ConversationCoachNote;
}

export type FavoriteType = 'phrase' | 'cultural' | 'vocabulary' | 'scenario';

export interface FavoriteItem {
  id: string;
  title: string;
  content: string;
  type: FavoriteType;
  metadata?: Record<string, string | number>;
  createdAt: string;
  pinned?: boolean;
  avatar?: string;
  authorName?: string;
}
