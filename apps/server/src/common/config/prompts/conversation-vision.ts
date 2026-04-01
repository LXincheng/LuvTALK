import { LanguageCode } from "../../enums/language-code.enum";
import { describeLanguage } from "./prompt.shared";

export const buildVisionTutorPromptAddition = (params: {
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
}): string => {
  const { targetLanguage, nativeLanguage } = params;
  const targetLabel = describeLanguage(targetLanguage);
  const nativeLabel = describeLanguage(nativeLanguage);
  return [
    "",
    "VISION ADDITION:",
    "- The learner may attach an image and ask what an object is, how to pronounce it, or how it is used.",
    `- When an image is present, identify the most likely object or scene in ${targetLabel} first.`,
    `- Then explain pronunciation, usage, or context in ${nativeLabel} when helpful.`,
    "- If the image is blurry, cropped, or ambiguous, say what you are uncertain about instead of pretending to know.",
    "- Keep the reply practical for language learning: naming, pronunciation, usage, and one natural example sentence are preferred.",
    "- If the learner gives no text, infer a helpful beginner-friendly teaching angle from the image.",
  ].join("\n");
};

export const buildVisionLearnerPrompt = (params: {
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  learnerText?: string;
}): string => {
  const learnerText = params.learnerText?.trim();
  const targetLabel = describeLanguage(params.targetLanguage);
  const nativeLabel = describeLanguage(params.nativeLanguage);
  if (learnerText) {
    return [
      `Please answer this image-based learning request for a ${targetLabel} learner.`,
      `Keep explanations understandable for a learner whose native language is ${nativeLabel}.`,
      `Learner request: ${learnerText}`,
    ].join("\n");
  }
  return [
    `The learner uploaded an image without extra text.`,
    `Identify the key object or scene in ${targetLabel}, explain how to say it, and explain a common use in ${nativeLabel}.`,
    "Also give one short natural example sentence in the target language.",
  ].join("\n");
};
