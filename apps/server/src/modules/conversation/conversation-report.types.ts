import { z } from "zod";
import { LanguageCode } from "../../common/enums/language-code.enum";
import { SessionSummaryPayload } from "./conversation-summary.types";

export type ConversationReportSourceMode = "immersive" | "voice" | "text";

export const ConversationReportMetricSchema = z.object({
  durationMinutes: z.number().int().min(1),
  userTurns: z.number().int().min(0),
  aiTurns: z.number().int().min(0),
  averageScore: z.number().int().min(0).max(100).nullable(),
  latestScore: z.number().int().min(0).max(100).nullable(),
  pronunciationMentions: z.number().int().min(0),
  grammarMentions: z.number().int().min(0),
  rhythmMentions: z.number().int().min(0),
  realtimeTurns: z.number().int().min(0),
});

export const ConversationReportSectionSchema = z.object({
  summary: z.string().min(1),
  highlights: z.array(z.string().min(1)).max(4).default([]),
  actionPlan: z.array(z.string().min(1)).max(4).default([]),
});

export const ConversationReportNextSessionPlanSchema = z.object({
  focus: z.string().min(1),
  drills: z.array(z.string().min(1)).max(4).default([]),
  checkpoint: z.string().min(1),
});

export const ConversationReportKeyMomentSchema = z.object({
  speaker: z.enum(["user", "ai"]),
  quote: z.string().min(1),
  note: z.string().min(1),
});

export const ConversationReportBodySchema = z.object({
  headline: z.string().min(1),
  overallSummary: z.string().min(1),
  learnerSnapshot: z.string().min(1),
  strengths: z.array(z.string().min(1)).max(4).default([]),
  opportunities: z.array(z.string().min(1)).max(4).default([]),
  pronunciation: ConversationReportSectionSchema,
  vocabulary: ConversationReportSectionSchema,
  grammar: ConversationReportSectionSchema,
  rhythm: ConversationReportSectionSchema,
  nextSessionPlan: ConversationReportNextSessionPlanSchema,
  keyMoments: z.array(ConversationReportKeyMomentSchema).max(3).default([]),
});

export type ConversationReportMetrics = z.infer<
  typeof ConversationReportMetricSchema
>;
export type ConversationReportBody = z.infer<
  typeof ConversationReportBodySchema
>;

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
  reportLanguage: "zh" | "en";
  metrics: ConversationReportMetrics;
  report: ConversationReportBody;
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
  reportLanguage: "zh" | "en";
  headline: string;
  overallSummary: string;
  averageScore: number | null;
  durationMinutes: number;
}

export interface ConversationReportPromptInput {
  sourceMode: ConversationReportSourceMode;
  voiceStyle?: string;
  summary: SessionSummaryPayload;
  scenarioId: string;
  scenarioLabel: string;
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  reportLanguage: "zh" | "en";
  transcriptLines: string[];
  pronunciationTips: string[];
  grammarTips: string[];
  rhythmTips: string[];
  scoreReasons: string[];
}
