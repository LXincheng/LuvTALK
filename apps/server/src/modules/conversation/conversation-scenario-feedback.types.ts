export type ScenarioFeedbackDimensionKey =
  | "taskCompletion"
  | "naturalness"
  | "pronunciation"
  | "resilience";

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
