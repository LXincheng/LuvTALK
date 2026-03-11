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

const SCENARIO_LABELS_ZH: Record<string, string> = {
  restaurant: "餐厅点单",
  shopping: "商店交流",
  directions: "问路指引",
  business: "商务寒暄",
  daily: "日常聊天",
};

const SCENARIO_LABELS_EN: Record<string, string> = {
  restaurant: "Dining etiquette",
  shopping: "Shopping chat",
  directions: "Asking for directions",
  business: "Business meetup",
  daily: "Daily small talk",
};

const LANGUAGE_LABELS = {
  zh: {
    cantonese: "粤语",
    mandarin: "普通话",
    english: "英语",
  },
  en: {
    cantonese: "Cantonese",
    mandarin: "Mandarin",
    english: "English",
  },
} as const;

export const resolveScenarioTitle = (
  scenarioId: string,
  nativeLanguage?: LanguageCode,
): string => {
  const prefersEnglish = nativeLanguage === LanguageCode.English;
  const map = prefersEnglish ? SCENARIO_LABELS_EN : SCENARIO_LABELS_ZH;
  return (
    map[scenarioId] ?? (prefersEnglish ? "Conversation practice" : "沉浸对话")
  );
};

export const resolveLanguageLabel = (
  language: LanguageCode,
  nativeLanguage: LanguageCode,
): string => {
  const locale = nativeLanguage === LanguageCode.English ? "en" : "zh";
  return LANGUAGE_LABELS[locale][language] ?? language;
};

export const resolveFallbackAssociativePhrases = (
  targetLanguage: LanguageCode,
  scenarioId: string,
): [string, string] => {
  if (targetLanguage === LanguageCode.English) {
    switch (scenarioId) {
      case "restaurant":
        return [
          "Could you recommend your signature dish?",
          "I'd like something light but flavorful.",
        ];
      case "directions":
        return [
          "Could you show me the fastest route?",
          "Is it within walking distance from here?",
        ];
      case "business":
        return [
          "Could we align on the next action today?",
          "Let's confirm the timeline before we proceed.",
        ];
      default:
        return [
          "Could you tell me more about that?",
          "That sounds great. What should I do next?",
        ];
    }
  }
  if (targetLanguage === LanguageCode.Cantonese) {
    return ["可唔可以介绍一个最啱新手嘅讲法？", "我下一句可以点样讲得更自然？"];
  }
  return ["你可以给我一个更地道的说法吗？", "我下一句怎么接会更自然？"];
};

export const buildFallbackReplyCopy = (
  message: string,
  language: LanguageCode,
  scenarioId: string,
): string => {
  if (language === LanguageCode.English) {
    return `I heard "${message}". Here is a natural ${scenarioId} response to keep things flowing.`;
  }
  if (language === LanguageCode.Cantonese) {
    return `我聽到你講：「${message}」。等我用地道講法繼續对话。`;
  }
  return `我听到你说：“${message}”。我来示范一个自然的续写方式。`;
};

export const FALLBACK_PLAIN_REPLY_SCORE_REASON =
  "基于语气、场景贴合度与可理解性的兜底估分";
