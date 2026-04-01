import { buildLayeredConversationPrompt } from "./conversation.builder";
import { ConversationPromptInput } from "./prompt.types";

export type PromptProfileId = "stable" | "exp_teaching_v1";

export const DEFAULT_PROMPT_PROFILE: PromptProfileId = "stable";

export const resolvePromptProfileId = (value?: string): PromptProfileId => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "exp_teaching_v1" || normalized === "exp-teaching-v1") {
    return "exp_teaching_v1";
  }
  return DEFAULT_PROMPT_PROFILE;
};

export const buildConversationSystemPromptWithProfile = (
  input: ConversationPromptInput,
  profile: PromptProfileId,
): string => {
  const base = buildLayeredConversationPrompt(input);
  if (profile === "stable") {
    return base;
  }

  // Experimental profile: keep the same schema contract, but add a small
  // quality guardrail section. This is only enabled via PROMPT_PROFILE and
  // should never change default production behavior.
  return [
    base,
    "",
    "QUALITY GUARD (exp_teaching_v1):",
    "- Keep outputs scenario-tied and learner-actionable.",
    "- In text mode, keep reply fully in the target language and move native-language coaching into correction and tip fields.",
    "- Avoid generic encouragement without a concrete next step.",
  ].join("\n");
};
