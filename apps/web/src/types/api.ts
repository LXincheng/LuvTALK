export type LanguageCode = 'cantonese' | 'mandarin' | 'english';

export type MessageSender = 'user' | 'ai';

export interface KeyTerm {
  term: string;
  definition: string;
  type?: string;
  examples?: string[];
}

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
    imageUrl?: string;
    imageMimeType?: string;
    ttsVoice?: string;
    ttsSpeed?: 'slow' | 'normal' | 'fast';
    source?: 'default' | 'realtime';
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
  accessKey?: string;
  userId?: string;
  title?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
  coach?: ConversationCoachNote;
}

export interface ConversationHistorySummary {
  id: string;
  scenarioId: string;
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode | null;
  updatedAt: string;
  score?: number;
  title?: string;
  status?: string;
  lastMessage: string;
  messageCount?: number;
}

export type FavoriteType = 'phrase' | 'cultural' | 'vocabulary' | 'scenario';

export interface FavoriteItem {
  id: string;
  type: FavoriteType;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  pinned?: boolean;
  authorName?: string;
  avatar?: string;
  conversationId?: string;
}

export interface VoiceUploadResponse {
  operationId: string;
  status: 'received';
}

export interface VoiceCatalogItem {
  defaultVoice: string;
  options: string[];
}

export type VoiceOperationStatus =
  | 'received'
  | 'transcribing'
  | 'responding'
  | 'completed'
  | 'failed';

export interface VoiceOperationSnapshot {
  operationId: string;
  conversationId: string;
  status: VoiceOperationStatus;
  audioUrl?: string;
  transcript?: string;
  error?: string;
  updatedAt: string;
}

export interface ScenarioHintPayload {
  kind: 'hint' | 'nudge';
  message: string;
  translation?: string;
}

export type ScenarioFeedbackDimensionKey =
  | 'taskCompletion'
  | 'naturalness'
  | 'pronunciation'
  | 'resilience';

export interface ScenarioFeedbackPayload {
  conversationId: string;
  overallScore: number;
  summary: string;
  headline: string;
  dimensions: Array<{
    key: ScenarioFeedbackDimensionKey;
    score: number;
  }>;
  suggestions: string[];
}

export type ReviewSourceType = 'favorite' | 'low_score';

export interface ReviewCard {
  id: string;
  term: string;
  definition?: string;
  example?: string;
  exampleTranslation?: string;
  sourceType: ReviewSourceType;
  favoriteType?: FavoriteType;
  conversationId?: string;
  score?: number;
}

export interface DailyReviewPayload {
  date: string;
  cards: ReviewCard[];
}

export interface SessionSummaryPayload {
  conversationId: string;
  durationMinutes: number;
  userTurns: number;
  aiTurns: number;
  averageScore: number | null;
  latestScore: number | null;
  headline: string;
  advice: string;
  strengths: string[];
  improvements: string[];
  recommendedNextActions: string[];
  keyTerms: Array<{
    term: string;
    definition: string;
  }>;
}

export interface ConversationQuickRepliesPayload {
  conversationId: string;
  options: string[];
}

