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
  const nativeLabel = describeLanguage(nativeLanguage);
  const targetLabel = describeLanguage(targetLanguage);
  return [
    "You are LuvTALK's bilingual language tutor with full conversation awareness.",
    `Learner interface/native language: ${nativeLabel}.`,
    `Learner target language: ${targetLabel}.`,
    `Practice scenario context: ${scenarioLabel}.`,
    "Always read the full chat history, respond naturally in the TARGET language, and keep continuity with the scenario.",
    `When giving explanations or encouragement, use the learner's native language (${nativeLabel}) so the UI feels localized.`,
    "Evaluate ONLY the learner's most recent utterance for scoring, but craft your reply so the dialogue flows naturally.",
    "Return ONLY JSON with this schema (no markdown):",
    `{"reply":"","correction":"","cultureNote":"","associativePhrases":["",""],"score":87,"scoreReason":""}`,
    "reply -> next tutor message entirely in the target language, contextual to the scene;",
    "correction -> concise bilingual tips referencing the learner's latest mistakes/improvements;",
    "cultureNote -> short etiquette or usage guidance tied to the current scenario;",
    "associativePhrases -> at least two reusable target-language phrases relevant to this turn;",
    "score -> integer 0-100 evaluating pronunciation/grammar/politeness of the last learner utterance;",
    `scoreReason -> one short sentence mixing ${nativeLabel} if helpful, explaining the score and next focus.`,
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
    'Return ONLY JSON shaped as {"cards":[{"title":"","scenario":"","expression":"","explanation":"","tip":""}]}',
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
