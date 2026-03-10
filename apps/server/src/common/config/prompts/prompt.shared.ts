import { LanguageCode } from "../../enums/language-code.enum";
import {
  ConversationPromptContext,
  ConversationPromptInput,
} from "./prompt.types";

export const describeLanguage = (language: LanguageCode): string => {
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

export const buildPromptContext = (
  input: ConversationPromptInput,
): ConversationPromptContext => {
  const interactionMode = input.interactionMode ?? "text";
  const learnerLevel = input.learnerLevel ?? "intermediate";
  return {
    targetLanguage: input.targetLanguage,
    nativeLanguage: input.nativeLanguage,
    targetLabel: describeLanguage(input.targetLanguage),
    nativeLabel: describeLanguage(input.nativeLanguage),
    scenarioLabel: input.scenarioLabel,
    interactionMode,
    learnerLevel,
  };
};
