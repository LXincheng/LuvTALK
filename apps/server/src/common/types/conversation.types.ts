import { FavoriteTypeEnum } from "../enums/favorite-type.enum";
import { LanguageCode } from "../enums/language-code.enum";
import type { KeyTerm } from "./ai-response.schema";

export type MessageSender = "user" | "ai";

export interface ConversationMessage {
  id: string;
  sender: MessageSender;
  text: string;
  language: LanguageCode;
  createdAt: string;
  senderName?: string;
  avatar?: string;
  meta?: {
    score?: number;
    scoreReason?: string;
    pronunciationTip?: string;
    rhythmTip?: string;
    grammarTip?: string;
    translation?: string;
    audioUrl?: string;
    keyTerms?: KeyTerm[];
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
  nativeLanguage?: LanguageCode;
  userId?: string;
  title?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
  coach?: ConversationCoachNote;
}

export interface FavoriteItem {
  id: string;
  type: FavoriteTypeEnum;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  pinned?: boolean;
  authorName?: string;
  avatar?: string;
  conversationId?: string;
}

export interface TranslationRecord {
  id: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  sourceText: string;
  translatedText: string;
  romanization?: string;
  cultureNote?: string;
  variations: Array<{
    label: string;
    text: string;
  }>;
  createdAt: string;
}
