import { ConversationMessage } from "../../common/types/conversation.types";

export interface SessionSummaryPayload {
  conversationId: string;
  durationMinutes: number;
  userTurns: number;
  aiTurns: number;
  averageScore: number | null;
  latestScore: number | null;
  strengths: string[];
  improvements: string[];
  recommendedNextActions: string[];
  keyTerms: Array<{
    term: string;
    definition: string;
  }>;
}

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

const LABELS = {
  zh: {
    stableExpression: "表达整体稳定，沟通流畅度较好。",
    sufficientPractice: "练习轮次充足，持续输出表现不错。",
    improvingTrend: "后半段表现提升明显，学习状态在变好。",
    keepPracticing: "你已保持持续练习，建议继续稳定输出短句。",
    focusAccuracy: "下一轮先用 2-3 个短句表达，优先保证准确度。",
    pronunciationDrill: "开启语音模式跟读 3 轮，重点校准发音与停顿。",
    grammarRewrite: "把本轮错误句改写 2 次，再用于下一轮对话。",
    reuseExpressions: "进入下一轮场景对话，优先复用本轮高频表达。",
  },
  en: {
    stableExpression: "Overall expression is stable with good fluency.",
    sufficientPractice: "Plenty of practice turns with consistent output.",
    improvingTrend: "Noticeable improvement in the second half of the session.",
    keepPracticing: "Keep practicing — focus on short, accurate sentences.",
    focusAccuracy: "Start the next round with 2–3 short sentences, prioritizing accuracy.",
    pronunciationDrill: "Use voice mode for 3 rounds of shadowing to refine pronunciation.",
    grammarRewrite: "Rewrite this round's errors twice and reuse them next round.",
    reuseExpressions: "Move to the next scenario and prioritize reusing key phrases.",
  },
} as const;

export function buildSessionSummary(params: {
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
  locale?: string;
}): SessionSummaryPayload {
  const l = params.locale === "en" ? LABELS.en : LABELS.zh;

  const userMessages = params.messages.filter(
    (message) => message.sender === "user",
  );
  const aiMessages = params.messages.filter(
    (message) => message.sender === "ai",
  );
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

  const strengths: string[] = [];
  if (typeof averageScore === "number" && averageScore >= 85) {
    strengths.push(l.stableExpression);
  }
  if (userMessages.length >= 6) {
    strengths.push(l.sufficientPractice);
  }
  if (
    latestScore !== null &&
    averageScore !== null &&
    latestScore > averageScore
  ) {
    strengths.push(l.improvingTrend);
  }
  if (!strengths.length) {
    strengths.push(l.keepPracticing);
  }

  const improvements = dedupe(
    aiMessages
      .flatMap((message) => [
        message.meta?.grammarTip,
        message.meta?.pronunciationTip,
        message.meta?.rhythmTip,
        message.meta?.scoreReason,
      ])
      .filter((value): value is string => typeof value === "string")
      .slice(0, 8),
  );

  const recommendedNextActions: string[] = [];
  if (latestScore !== null && latestScore < 75) {
    recommendedNextActions.push(l.focusAccuracy);
  }
  if (
    improvements.some(
      (item) => item.includes("发音") || item.includes("pronunciation"),
    )
  ) {
    recommendedNextActions.push(l.pronunciationDrill);
  }
  if (
    improvements.some(
      (item) => item.includes("语法") || item.includes("grammar"),
    )
  ) {
    recommendedNextActions.push(l.grammarRewrite);
  }
  if (!recommendedNextActions.length) {
    recommendedNextActions.push(l.reuseExpressions);
  }

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

  const start = new Date(params.createdAt).getTime();
  const end = new Date(params.updatedAt).getTime();
  const durationMinutes =
    Number.isFinite(start) && Number.isFinite(end) && end > start
      ? Math.max(1, Math.round((end - start) / 60000))
      : 1;

  return {
    conversationId: params.conversationId,
    durationMinutes,
    userTurns: userMessages.length,
    aiTurns: aiMessages.length,
    averageScore,
    latestScore,
    strengths,
    improvements: improvements.slice(0, 4),
    recommendedNextActions: dedupe(recommendedNextActions).slice(0, 3),
    keyTerms,
  };
}
