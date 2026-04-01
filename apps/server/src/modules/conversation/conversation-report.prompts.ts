import { resolveScenarioLabel } from "../../common/config/prompts/scenario.config";
import { describeLanguage } from "../../common/config/prompts/prompt.shared";
import { LanguageCode } from "../../common/enums/language-code.enum";
import type { ConversationReportPromptInput } from "./conversation-report.types";

interface ScenarioFeedbackPromptInput {
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  reportLanguage: "zh" | "en";
  scenarioId: string;
  scenarioLabel: string;
  userTurns: number;
  aiTurns: number;
  averageScore: number | null;
  latestScore: number | null;
  pronunciationMentions: number;
  grammarMentions: number;
  rhythmMentions: number;
  strengths: string[];
  improvements: string[];
  transcriptLines: string[];
}

const resolveOutputLanguage = (reportLanguage: "zh" | "en"): string =>
  reportLanguage === "zh" ? "Simplified Chinese" : "English";

const resolveSourceModeLabel = (
  sourceMode: ConversationReportPromptInput["sourceMode"],
): string => {
  if (sourceMode === "immersive") {
    return "immersive realtime voice session";
  }
  if (sourceMode === "voice") {
    return "voice tutoring session";
  }
  return "text tutoring session";
};

export const buildConversationReportSystemPrompt = (
  reportLanguage: "zh" | "en",
): string => {
  return [
    "You are a premium 1-on-1 language coaching analyst.",
    `Write the report in ${resolveOutputLanguage(reportLanguage)}.`,
    "Use only evidence that exists in the provided transcript, score trends, and coaching tips.",
    "Never confuse the learner's native/interface language with the learner's target study language.",
    "If direct acoustic evidence is limited, say the pronunciation or rhythm judgment is based on in-session system coaching tips.",
    "Anchor pronunciation, rhythm, and pacing feedback to the tutor system voice when it is provided.",
    "Be specific, practical, premium, and non-generic.",
    "Prefer concise, high-signal language and clear action items over long explanations.",
    "Return ONLY one valid JSON object.",
    "JSON shape:",
    "{",
    '  "headline": "string",',
    '  "overallSummary": "string",',
    '  "learnerSnapshot": "string",',
    '  "strengths": ["string"],',
    '  "opportunities": ["string"],',
    '  "pronunciation": { "summary": "string", "highlights": ["string"], "actionPlan": ["string"] },',
    '  "vocabulary": { "summary": "string", "highlights": ["string"], "actionPlan": ["string"] },',
    '  "grammar": { "summary": "string", "highlights": ["string"], "actionPlan": ["string"] },',
    '  "rhythm": { "summary": "string", "highlights": ["string"], "actionPlan": ["string"] },',
    '  "nextSessionPlan": { "focus": "string", "drills": ["string"], "checkpoint": "string" },',
    '  "keyMoments": [{ "speaker": "user" | "ai", "quote": "string", "note": "string" }]',
    "}",
    "Keep arrays concise: strengths/opportunities/highlights/actionPlan/drills max 3 items; keyMoments max 3 items.",
    "Do not use markdown.",
  ].join("\n");
};

export const buildScenarioFeedbackSystemPrompt = (
  reportLanguage: "zh" | "en",
): string => {
  return [
    "You are a fast premium language-practice evaluator for scenario dialogue.",
    `Write the result in ${resolveOutputLanguage(reportLanguage)}.`,
    "Use only the session metrics and transcript provided.",
    "Never confuse the learner's native/interface language with the learner's target study language.",
    "Score conservatively. If the learner barely practiced, keep the score clearly low.",
    "Do not reward empty or one-turn sessions with inflated scores.",
    "Return ONLY one valid JSON object.",
    "JSON shape:",
    "{",
    '  "headline": "string",',
    '  "summary": "string",',
    '  "overallScore": 0,',
    '  "dimensions": {',
    '    "taskCompletion": 0,',
    '    "naturalness": 0,',
    '    "pronunciation": 0,',
    '    "resilience": 0',
    "  },",
    '  "suggestions": ["string", "string", "string"]',
    "}",
    "Each suggestion must be concrete and short.",
    "Do not use markdown.",
  ].join("\n");
};

export const buildConversationReportUserPrompt = (
  input: ConversationReportPromptInput,
): string => {
  return [
    `Scenario key: ${input.scenarioId}`,
    `Scenario label: ${input.scenarioLabel}`,
    `Learner native/interface language: ${describeLanguage(input.nativeLanguage)}`,
    `Learner target study language: ${describeLanguage(input.targetLanguage)}`,
    `Output report language: ${input.reportLanguage === "zh" ? "Chinese" : "English"}`,
    `Session type: ${resolveSourceModeLabel(input.sourceMode)}`,
    `Tutor system voice: ${input.voiceStyle ?? "not provided"}`,
    "If a tutor system voice is provided, align pacing and delivery feedback to that voice style.",
    "Session metrics:",
    JSON.stringify(input.summary, null, 2),
    "Pronunciation tips:",
    JSON.stringify(input.pronunciationTips, null, 2),
    "Grammar tips:",
    JSON.stringify(input.grammarTips, null, 2),
    "Rhythm tips:",
    JSON.stringify(input.rhythmTips, null, 2),
    "Score reasons:",
    JSON.stringify(input.scoreReasons, null, 2),
    "Transcript excerpts:",
    input.transcriptLines.join("\n"),
    "Write a polished premium review report with clear coaching suggestions.",
  ].join("\n\n");
};

export const buildScenarioFeedbackUserPrompt = (
  input: ScenarioFeedbackPromptInput,
): string => {
  return [
    `Scenario key: ${input.scenarioId}`,
    `Scenario label: ${input.scenarioLabel || resolveScenarioLabel(input.scenarioId, input.nativeLanguage)}`,
    `Learner native/interface language: ${describeLanguage(input.nativeLanguage)}`,
    `Learner target study language: ${describeLanguage(input.targetLanguage)}`,
    `Output language: ${input.reportLanguage === "zh" ? "Chinese" : "English"}`,
    `Learner turns: ${input.userTurns}`,
    `Tutor turns: ${input.aiTurns}`,
    `Average score: ${input.averageScore ?? "null"}`,
    `Latest score: ${input.latestScore ?? "null"}`,
    `Pronunciation mentions: ${input.pronunciationMentions}`,
    `Grammar mentions: ${input.grammarMentions}`,
    `Rhythm mentions: ${input.rhythmMentions}`,
    `Strength hints: ${JSON.stringify(input.strengths)}`,
    `Improvement hints: ${JSON.stringify(input.improvements)}`,
    "Recent transcript:",
    input.transcriptLines.join("\n"),
  ].join("\n\n");
};
