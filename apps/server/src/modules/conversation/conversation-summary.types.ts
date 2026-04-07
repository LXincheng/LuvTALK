import { ConversationMessage } from "../../common/types/conversation.types";

export interface SessionSummaryPayload {
  conversationId: string;
  durationMinutes: number;
  userTurns: number;
  aiTurns: number;
  averageScore: number | null;
  latestScore: number | null;
  headline: string;
  advice: string;
  strengths: string[];
  improvements: string[];
  recommendedNextActions: string[];
  keyTerms: Array<{
    term: string;
    definition: string;
  }>;
}

type LocaleBundle = {
  shortRound: string;
  defaultTopic: string;
  headlineEmpty: string;
  adviceEmpty: string;
  strengthTopic: (topic: string) => string;
  strengthProgress: string;
  strengthFluency: string;
  strengthPersistence: string;
  strengthDefault: string;
  actionAccuracy: string;
  actionTopic: (topic: string) => string;
  actionQuestion: (topic: string) => string;
  actionPronunciation: string;
  actionGrammar: string;
  actionRhythm: string;
};

const dedupe = (items: string[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];
  items.forEach((item) => {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    output.push(normalized);
  });
  return output;
};

const cleanText = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || undefined;
};

const shorten = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trimEnd()}...`;
};

const GENERIC_SUMMARY_PATTERNS = [
  /继续加油/,
  /keep it up/i,
  /做得好/,
  /good job/i,
  /整体稳定/,
  /overall expression is stable/i,
];

const isMeaningfulTip = (value?: string): value is string => {
  const normalized = cleanText(value);
  if (!normalized) {
    return false;
  }
  return !GENERIC_SUMMARY_PATTERNS.some((pattern) => pattern.test(normalized));
};

const LABELS: Record<"zh" | "en", LocaleBundle> = {
  zh: {
    shortRound: "这一轮",
    defaultTopic: "当前话题",
    headlineEmpty: "这一轮还比较短，但你已经开始进入目标语言语境了。",
    adviceEmpty: "下一轮先直接回答问题，再补一个和场景相关的小细节。",
    strengthTopic: (topic) => `你一直围绕“${topic}”推进，没有偏离当前场景。`,
    strengthProgress: "后半段回答比前面更完整，说明你在边说边调整。",
    strengthFluency: "多轮接话都能把意思说清楚，流畅度在往上走。",
    strengthPersistence: "你愿意连续往下说，而不是停在单句，互动感更自然。",
    strengthDefault: "你已经能持续用目标语言把意思表达出来了。",
    actionAccuracy: "下一轮先用更短的句子把核心意思说准，再补细节。",
    actionTopic: (topic) => `下一轮继续围绕“${topic}”练，先说结论，再补一个具体信息。`,
    actionQuestion: (topic) => `下一句先正面回应“${topic}”，再顺势补一个原因或细节。`,
    actionPronunciation: "下一轮用语音再练 2 到 3 句，重点把重音和停顿拉开。",
    actionGrammar: "把刚才容易卡住的句型改写一遍，再放回同一场景里复用。",
    actionRhythm: "下一句刻意分成两小段来讲，先把节奏放稳。",
  },
  en: {
    shortRound: "This round",
    defaultTopic: "this topic",
    headlineEmpty:
      "This round was brief, but you already started thinking inside the target language.",
    adviceEmpty:
      "Next round, answer directly first and add one scene-relevant detail after that.",
    strengthTopic: (topic) =>
      `You stayed anchored on "${topic}" instead of drifting away from the scene.`,
    strengthProgress:
      "Your later turns carried more detail than the opening ones, which shows active adjustment.",
    strengthFluency:
      "Across multiple turns, you kept the exchange moving and the meaning clear.",
    strengthPersistence:
      "You kept extending the conversation instead of stopping at one short sentence.",
    strengthDefault:
      "You are already able to express the core idea in the target language.",
    actionAccuracy:
      "Next round, keep the first sentence shorter so the core meaning lands cleanly.",
    actionTopic: (topic) =>
      `Stay on "${topic}" next round: answer first, then add one concrete detail.`,
    actionQuestion: (topic) =>
      `Reply to "${topic}" more directly next time, then add a short reason or detail.`,
    actionPronunciation:
      "Use voice mode for 2 or 3 turns and exaggerate stress plus pauses on purpose.",
    actionGrammar:
      "Rewrite the sentence pattern that felt shaky, then reuse it in the same scene.",
    actionRhythm:
      "Break your next turn into two short chunks so the rhythm feels less rushed.",
  },
};

const getLatestUserTopic = (
  messages: ConversationMessage[],
  locale: "zh" | "en",
  keyTerms: Array<{ term: string; definition: string }>,
): string | undefined => {
  const latestUserText = [...messages]
    .reverse()
    .find((message) => message.sender === "user" && cleanText(message.text))
    ?.text;
  const normalized = cleanText(latestUserText);
  if (normalized) {
    return shorten(normalized, locale === "en" ? 42 : 24);
  }
  return keyTerms[0]?.term;
};

const getLatestAiQuestionFocus = (messages: ConversationMessage[]): string | undefined => {
  const latestAiText = [...messages]
    .reverse()
    .find((message) => message.sender === "ai" && cleanText(message.text))
    ?.text;
  const normalized = cleanText(latestAiText);
  if (!normalized) {
    return undefined;
  }
  if (!/[?？]$/.test(normalized)) {
    return undefined;
  }
  return shorten(normalized.replace(/[?？]+$/, ""), 36);
};

const buildHeadline = (params: {
  labels: LocaleBundle;
  locale: "zh" | "en";
  userTurns: number;
  averageScore: number | null;
  latestScore: number | null;
  topic?: string;
}): string => {
  const { labels, locale, userTurns, averageScore, latestScore, topic } = params;
  if (userTurns === 0) {
    return labels.headlineEmpty;
  }

  const progressDelta =
    typeof latestScore === "number" && typeof averageScore === "number"
      ? latestScore - averageScore
      : null;

  if (topic && progressDelta !== null && progressDelta >= 4) {
    return locale === "en"
      ? `You handled "${topic}" with noticeably more control in the later turns.`
      : `这轮你围绕“${topic}”越说越顺，后半段明显更稳。`;
  }

  if (topic && userTurns >= 3) {
    return locale === "en"
      ? `You kept the conversation on "${topic}" and responded with better continuity.`
      : `这轮你一直围绕“${topic}”接话，连续表达比前面更自然。`;
  }

  if (typeof averageScore === "number" && averageScore >= 85) {
    return locale === "en"
      ? "Several turns already sounded usable in a real conversation."
      : "这一轮里已经有几句可以直接放进真实场景里用了。";
  }

  return locale === "en"
    ? "You kept turning ideas into complete target-language responses."
    : "这轮你已经能把自己的意思持续落成完整回应了。";
};

export function buildSessionSummary(params: {
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
  locale?: string;
}): SessionSummaryPayload {
  const locale = params.locale === "en" ? "en" : "zh";
  const labels = LABELS[locale];

  const userMessages = params.messages.filter(
    (message) => message.sender === "user",
  );
  const aiMessages = params.messages.filter((message) => message.sender === "ai");
  const scoreMessages = aiMessages.filter(
    (message) => typeof message.meta?.score === "number",
  );

  const scores = scoreMessages.map((message) => message.meta!.score as number);
  const averageScore =
    scores.length > 0
      ? Math.round(
          scores.reduce((sum, value) => sum + value, 0) / scores.length,
        )
      : null;
  const latestScore = scores.length > 0 ? scores[scores.length - 1] : null;

  const keyTerms = params.messages
    .flatMap((message) => message.meta?.keyTerms ?? [])
    .map((term) => ({
      term: term.term.trim(),
      definition: term.definition.trim(),
    }))
    .filter((item) => item.term && item.definition)
    .filter((item, index, array) => {
      return (
        array.findIndex(
          (current) => current.term.toLowerCase() === item.term.toLowerCase(),
        ) === index
      );
    })
    .slice(0, 6);

  const improvements = dedupe(
    aiMessages
      .flatMap((message) => [
        message.meta?.grammarTip,
        message.meta?.pronunciationTip,
        message.meta?.rhythmTip,
        message.meta?.scoreReason,
      ])
      .filter(isMeaningfulTip)
      .slice(0, 8),
  );

  const meaningfulMessages = params.messages.filter((message) => {
    const text = message.text?.trim();
    return Boolean(text && text !== "（等待输入）");
  });
  const firstMessageAt = meaningfulMessages[0]?.createdAt ?? params.createdAt;
  const lastMessageAt =
    meaningfulMessages[meaningfulMessages.length - 1]?.createdAt ??
    params.updatedAt;
  const start = new Date(firstMessageAt).getTime();
  const end = new Date(lastMessageAt).getTime();
  const durationMinutes =
    Number.isFinite(start) && Number.isFinite(end) && end > start
      ? Math.max(1, Math.ceil((end - start) / 60000))
      : 1;

  const topic =
    getLatestUserTopic(params.messages, locale, keyTerms) ?? labels.defaultTopic;
  const questionFocus = getLatestAiQuestionFocus(params.messages);

  const strengths = dedupe([
    userMessages.length >= 2 ? labels.strengthPersistence : "",
    userMessages.length >= 4 ? labels.strengthFluency : "",
    typeof latestScore === "number" &&
    typeof averageScore === "number" &&
    latestScore >= averageScore + 4
      ? labels.strengthProgress
      : "",
    topic ? labels.strengthTopic(topic) : "",
    typeof averageScore === "number" && averageScore >= 85
      ? labels.strengthFluency
      : "",
    labels.strengthDefault,
  ]).slice(0, 3);

  const recommendedNextActions = dedupe([
    questionFocus ? labels.actionQuestion(questionFocus) : "",
    improvements.some(
      (item) => item.includes("发音") || item.includes("pronunciation"),
    )
      ? labels.actionPronunciation
      : "",
    improvements.some(
      (item) => item.includes("语法") || item.includes("grammar"),
    )
      ? labels.actionGrammar
      : "",
    improvements.some(
      (item) => item.includes("停顿") || item.includes("rhythm") || item.includes("节奏"),
    )
      ? labels.actionRhythm
      : "",
    latestScore !== null && latestScore < 75 ? labels.actionAccuracy : "",
    topic ? labels.actionTopic(topic) : "",
    labels.adviceEmpty,
  ]).slice(0, 3);

  const headline = buildHeadline({
    labels,
    locale,
    userTurns: userMessages.length,
    averageScore,
    latestScore,
    topic,
  });
  const advice =
    recommendedNextActions[0] ?? improvements[0] ?? labels.adviceEmpty;

  return {
    conversationId: params.conversationId,
    durationMinutes,
    userTurns: userMessages.length,
    aiTurns: aiMessages.length,
    averageScore,
    latestScore,
    headline,
    advice,
    strengths,
    improvements: improvements.slice(0, 4),
    recommendedNextActions,
    keyTerms,
  };
}
