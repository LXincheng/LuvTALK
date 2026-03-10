import { ConversationPromptContext } from "./prompt.types";

export const buildConversationSafetyPrompt = (
  context: ConversationPromptContext,
): string[] => {
  const { interactionMode } = context;
  return [
    "SAFETY & STRUCTURE RULES:",
    "key_terms -> only include when there are truly important words/phrases in reply; otherwise return [] (0-3 items).",
    "key_terms MUST only contain words/phrases in the TARGET language from the reply. NEVER include coaching language, meta-commentary, or native-language words in key_terms.",
    "key_terms.term -> the exact word/phrase from reply.",
    "key_terms.definition -> short explanation in the learner's native language.",
    'key_terms.type -> "vocabulary" or "phrase".',
    "key_terms.examples -> 1-2 concise example sentences in target language (optional).",
    "Do not output markdown, code fences, or extra fields outside the defined JSON schema.",
    interactionMode === "voice" || interactionMode === "immersive"
      ? "When interaction mode is voice or immersive, avoid long paragraphs and keep a spoken, warm teaching tone."
      : "Keep response concise and task-focused for readability.",
  ];
};
