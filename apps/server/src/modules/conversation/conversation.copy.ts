import { LanguageCode } from "../../common/enums/language-code.enum";

export const buildWelcomeCopy = (params: {
  title: string;
  targetLabel: string;
  nativeLabel: string;
  nativeLanguage: LanguageCode;
}): string => {
  const { title, targetLabel, nativeLabel, nativeLanguage } = params;
  if (nativeLanguage === LanguageCode.English) {
    return `👋 Welcome to the ${title} scenario.\nI'll coach you in ${targetLabel} and share tips in ${nativeLabel}. Let's warm up with a friendly greeting.`;
  }
  return `👋 欢迎来到${title}练习场景。\n我会用${targetLabel}陪你练习，并用${nativeLabel}提供提示。先来一句轻松的寒暄吧。`;
};

export const resolveSpeakerName = (
  sender: "ai" | "user",
  nativeLanguage?: LanguageCode,
): string => {
  const prefersEnglish = nativeLanguage === LanguageCode.English;
  if (sender === "ai") {
    return prefersEnglish ? "LuvTALK Tutor" : "LuvTALK 导师";
  }
  return prefersEnglish ? "You" : "我";
};

export const FALLBACK_SCORE_REASON = {
  en: "Fallback scoring based on plain-text response.",
  zh: "返回纯文本，已启用教学兜底评分。",
} as const;
