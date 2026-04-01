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
  memoryEnabled?: boolean;
  deepThinkingEnabled?: boolean;
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
  strengths: string[];
  improvements: string[];
  recommendedNextActions: string[];
  keyTerms: Array<{
    term: string;
    definition: string;
  }>;
}

export type ConversationReportSourceMode = 'immersive' | 'voice' | 'text';

export interface ConversationReportMetrics {
  durationMinutes: number;
  userTurns: number;
  aiTurns: number;
  averageScore: number | null;
  latestScore: number | null;
  pronunciationMentions: number;
  grammarMentions: number;
  rhythmMentions: number;
  realtimeTurns: number;
}

export interface ConversationReportSection {
  summary: string;
  highlights: string[];
  actionPlan: string[];
}

export interface ConversationReportPayload {
  id: string;
  conversationId: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode | null;
  sourceMode: ConversationReportSourceMode;
  voiceStyle?: string;
  reportLanguage: 'zh' | 'en';
  metrics: ConversationReportMetrics;
  report: {
    headline: string;
    overallSummary: string;
    learnerSnapshot: string;
    strengths: string[];
    opportunities: string[];
    pronunciation: ConversationReportSection;
    vocabulary: ConversationReportSection;
    grammar: ConversationReportSection;
    rhythm: ConversationReportSection;
    nextSessionPlan: {
      focus: string;
      drills: string[];
      checkpoint: string;
    };
    keyMoments: Array<{
      speaker: 'user' | 'ai';
      quote: string;
      note: string;
    }>;
  };
}

export interface ConversationReportHistoryItem {
  id: string;
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode | null;
  sourceMode: ConversationReportSourceMode;
  voiceStyle?: string;
  reportLanguage: 'zh' | 'en';
  headline: string;
  overallSummary: string;
  averageScore: number | null;
  durationMinutes: number;
}
