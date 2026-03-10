import { LanguageCode } from "../enums/language-code.enum";
import { buildLayeredConversationPrompt } from "./prompts/conversation.builder";
import {
  buildConversationSystemPromptWithProfile,
  resolvePromptProfileId,
} from "./prompts/prompt.profile";
import { describeLanguage } from "./prompts/prompt.shared";
import type {
  ConversationPromptInput,
  TutorInteractionMode,
  TutorLearnerLevel,
} from "./prompts/prompt.types";

export type { TutorInteractionMode, TutorLearnerLevel };

interface RealtimePromptInput {
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  scenarioLabel: string;
}

interface CulturePromptInput {
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
}

export const buildConversationSystemPrompt = (
  input: ConversationPromptInput,
): string => {
  const profile = resolvePromptProfileId(process.env.PROMPT_PROFILE);
  return buildConversationSystemPromptWithProfile(input, profile);
};

export const buildRealtimeSystemPrompt = ({
  targetLanguage,
  nativeLanguage,
  scenarioLabel,
}: RealtimePromptInput): string => {
  const nativeLabel = describeLanguage(nativeLanguage);
  const targetLabel = describeLanguage(targetLanguage);
  return [
    "You are LuvTALK's real-time voice language tutor having a LIVE CONVERSATION.",
    `Learner native language: ${nativeLabel}.`,
    `Target language: ${targetLabel}.`,
    `Scenario: ${scenarioLabel}.`,
    "",
    "CRITICAL RULES FOR REAL-TIME VOICE:",
    "- Respond with EXACTLY ONE short sentence at a time, like a real person talking.",
    "- Keep each response under 15 words, with natural spoken rhythm and a friendly tutor tone.",
    "- After you speak, WAIT for the learner to respond. Do NOT continue talking.",
    "- Do NOT monologue, lecture, or give long explanations.",
    "- Do NOT repeat or rephrase what you just said.",
    "- If the learner is silent, wait patiently. Do NOT fill the silence.",
    "",
    "CONVERSATION STYLE:",
    `- Speak naturally in ${targetLabel}, like chatting with a friend.`,
    "- Ask ONE question at a time, then wait for the answer.",
    `- If the learner struggles, give a SHORT hint in ${nativeLabel}, then switch back.`,
    "- Correct mistakes naturally within conversation, not as separate feedback.",
    "- Prioritize one actionable correction at a time (pronunciation OR grammar), never both in one turn.",
    "- Use encouraging phrasing before correction to reduce learner anxiety.",
    "- Do NOT output JSON, metadata, or any structured format.",
  ].join("\n");
};

export const buildCulturePrompt = ({
  targetLanguage,
  nativeLanguage,
}: CulturePromptInput): string => {
  return [
    "You are a cultural learning coach for LuvTALK.",
    `Learner native language: ${describeLanguage(nativeLanguage)}.`,
    `Target language: ${describeLanguage(targetLanguage)}.`,
    "Generate 3 concise culture cards for language learners.",
    "Each card must include: title, scenario, expression (target language), explanation (native language), tip (actionable advice).",
    'Return ONLY JSON shaped as {"cards":[{"title":"","scenario":"","expression":"","explanation":"","tip":""}]}',
    "Cards must be practical, mention etiquette or context, and avoid generic filler.",
  ].join("\n");
};
