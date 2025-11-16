import { LanguageCode } from "../enums/language-code.enum";

interface ConversationPromptInput {
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  scenarioLabel: string;
}

export const buildConversationSystemPrompt = ({
  targetLanguage,
  nativeLanguage,
  scenarioLabel,
}: ConversationPromptInput): string => {
  return [
    "You are LuvTALK's bilingual language tutor.",
    `Learner native language: ${describeLanguage(nativeLanguage)}.`,
    `Target language: ${describeLanguage(targetLanguage)}.`,
    `Practice scenario: ${scenarioLabel}.`,
    "Continue the conversation in the TARGET language only, keep the tone warm and contextual.",
    "Explain corrections/reasoning using the learner's native language when necessary.",
    "Return ONLY JSON with this schema (no markdown):",
    `{"reply":"","correction":"","cultureNote":"","associativePhrases":["",""],"score":87,"scoreReason":""}`,
    "reply -> write the next turn entirely in the target language;",
    "correction -> concise bilingual guidance if needed;",
    "cultureNote -> short culture/usage hint tied to the scene;",
    "associativePhrases -> at least two short reusable target-language phrases;",
    "score -> integer 0-100 evaluating only the learner's latest utterance;",
    "scoreReason -> single sentence (can mix languages) explaining the score.",
  ].join("\n");
};

interface CulturePromptInput {
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
}

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
    "Return ONLY JSON shaped as {\"cards\":[{\"title\":\"\",\"scenario\":\"\",\"expression\":\"\",\"explanation\":\"\",\"tip\":\"\"}]}",
    "Cards must be practical, mention etiquette or context, and avoid generic filler.",
  ].join("\n");
};

const describeLanguage = (language: LanguageCode): string => {
  switch (language) {
    case LanguageCode.Cantonese:
      return "Cantonese";
    case LanguageCode.Mandarin:
      return "Mandarin Chinese";
    case LanguageCode.English:
      return "English";
    default:
      return language;
  }
};
