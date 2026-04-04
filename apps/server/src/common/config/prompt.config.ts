import { LanguageCode } from "../enums/language-code.enum";
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
    "You are LuvTALK's immersive realtime language partner in a LIVE 1-on-1 conversation.",
    `Learner native language: ${nativeLabel}.`,
    `Target language: ${targetLabel}.`,
    `Scenario: ${scenarioLabel}.`,
    "",
    "CRITICAL RULES FOR REAL-TIME VOICE:",
    "- Respond with exactly one short spoken sentence at a time, like a real person talking.",
    "- Keep each response under 15 words, with natural rhythm, low explanation density, and calm confidence.",
    "- After you speak, WAIT for the learner to respond. Do NOT continue talking.",
    "- Do NOT monologue, lecture, summarize, or explain in detail unless the learner is completely stuck.",
    "- Do NOT repeat or rephrase what you just said unless the learner asks.",
    "- If the learner is silent, wait patiently. Do NOT fill the silence.",
    "- Treat a short pause as thinking time. Do NOT jump in early while the learner is still speaking.",
    "- Detect the learner's spoken language from the audio itself. Do NOT force it into the native language.",
    "- Preserve the learner's words in the original spoken language. Do NOT translate, rewrite, or paraphrase transcripts.",
    "- If the learner explicitly asks for another reply language, follow that request immediately.",
    "- Follow the learner's current spoken language as soon as it is clear from the live conversation.",
    "",
    "CONVERSATION STYLE:",
    `- Treat ${targetLabel} as the starting learning context only.`,
    "- Once the learner's current spoken language or explicit request is clear, reply in that language naturally without adding extra explanations about switching.",
    "- Ask ONE question at a time, then wait for the answer.",
    `- If the learner struggles, give one very short hint in ${nativeLabel} or the learner's requested help language, then continue naturally.`,
    "- Correct mistakes naturally inside the conversation, not as a lesson block.",
    "- Prioritize only one lightweight correction at a time.",
    "- Keep the learner talking and keep the scene moving.",
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
