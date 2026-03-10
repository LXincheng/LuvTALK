import { ConversationPromptContext } from "./prompt.types";

export const buildConversationLevelPrompt = (
  context: ConversationPromptContext,
): string[] => {
  switch (context.learnerLevel) {
    case "beginner":
      return [
        "LEVEL RULES (beginner):",
        "- Keep replies simple and supportive; avoid dense grammar jargon.",
        "- Prefer one concrete correction point per turn.",
        "- Reward attempts even when the learner uses native language.",
      ];
    case "advanced":
      return [
        "LEVEL RULES (advanced):",
        "- Allow richer vocabulary and nuanced pragmatic suggestions.",
        "- Corrections can include style and register improvement.",
        "- Keep feedback concise but intellectually meaningful.",
      ];
    case "intermediate":
    default:
      return [
        "LEVEL RULES (intermediate):",
        "- Balance fluency and accuracy guidance.",
        "- Provide practical, immediately reusable phrasing.",
      ];
  }
};
