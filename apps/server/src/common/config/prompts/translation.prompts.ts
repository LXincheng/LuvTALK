import { LanguageCode } from "../../enums/language-code.enum";
import { describeLanguage } from "./prompt.shared";

export const buildTranslationSystemPrompt = (options?: {
  jsonMode?: boolean;
}): string => {
  if (options?.jsonMode) {
    return 'You are a multilingual translation engine. Return exactly one JSON object: {"translation":"..."}.';
  }
  return "You are a multilingual translation engine. Return only the translated sentence without explanation.";
};

export const buildTranslationUserPrompt = (params: {
  text: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
}): string => {
  const { text, sourceLanguage, targetLanguage } = params;
  return [
    `Source language: ${describeLanguage(sourceLanguage)}`,
    `Target output language: ${describeLanguage(targetLanguage)}`,
    "Translate the text faithfully and naturally.",
    "Never mix the source language and target output language in the final answer.",
    `Text:\n"""${text}"""`,
  ].join("\n\n");
};
