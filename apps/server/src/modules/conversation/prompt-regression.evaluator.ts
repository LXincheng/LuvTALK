import { LanguageCode } from "../../common/enums/language-code.enum";
import {
  PromptRegressionCase,
  PromptRegressionResult,
} from "./prompt-regression.types";

const ACTIONABLE_CN_HINTS = [
  "先",
  "再",
  "尝试",
  "练习",
  "注意",
  "可以",
  "建议",
];
const ACTIONABLE_EN_HINTS = [
  "try",
  "use",
  "start",
  "then",
  "keep",
  "practice",
  "focus",
  "remember",
];

const SCENARIO_KEYWORDS: Record<string, string[]> = {
  restaurant: ["dish", "menu", "order", "signature", "菜", "点餐", "推荐"],
  directions: ["route", "walk", "distance", "map", "路线", "怎么走", "距离"],
  business: ["timeline", "action", "align", "meeting", "计划", "进度", "安排"],
  daily: [
    "today",
    "tomorrow",
    "day",
    "next",
    "plan",
    "chat",
    "今天",
    "明天",
    "下一步",
    "日常",
  ],
};

const hasStructuredStudySteps = (reply: string): boolean => {
  return (
    /(\n|^)\s*(学习建议|Study Steps)[:：]/i.test(reply) ||
    /(\n|^)\s*1[\).]/.test(reply)
  );
};

const countNonEmptyTips = (input: string[]): number => {
  return input.map((item) => item.trim()).filter((item) => item.length > 0)
    .length;
};

const hasActionableHint = (
  text: string,
  nativeLanguage: LanguageCode,
): boolean => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (nativeLanguage === LanguageCode.English) {
    return ACTIONABLE_EN_HINTS.some((token) => normalized.includes(token));
  }
  return ACTIONABLE_CN_HINTS.some((token) => text.includes(token));
};

const hasScenarioSignal = (text: string, scenarioId: string): boolean => {
  const keywords = SCENARIO_KEYWORDS[scenarioId] ?? SCENARIO_KEYWORDS.daily;
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
};

export const evaluatePromptRegressionCase = (
  testCase: PromptRegressionCase,
): PromptRegressionResult => {
  const checks: string[] = [];
  const failures: string[] = [];
  let score = 100;

  const reply = testCase.payload.reply.trim();
  if (reply.length < 24) {
    score -= 20;
    failures.push("reply_too_short");
  } else {
    checks.push("reply_length_ok");
  }

  if (testCase.interactionMode === "text") {
    if (hasStructuredStudySteps(reply)) {
      checks.push("text_has_study_steps");
    } else {
      score -= 30;
      failures.push("text_missing_study_steps");
    }
  }

  const tipCount = countNonEmptyTips([
    testCase.payload.correction ?? "",
    testCase.payload.pronunciationTip ?? "",
    testCase.payload.rhythmTip ?? "",
    testCase.payload.grammarTip ?? "",
  ]);
  if (tipCount < 1) {
    score -= 15;
    failures.push("missing_teaching_tip");
  } else {
    checks.push("teaching_tip_present");
  }

  const actionableSources = [
    testCase.payload.correction ?? "",
    testCase.payload.pronunciationTip ?? "",
    testCase.payload.grammarTip ?? "",
    testCase.payload.rhythmTip ?? "",
    reply,
  ];
  const actionable = actionableSources.some((entry) =>
    hasActionableHint(entry, testCase.nativeLanguage),
  );
  if (!actionable) {
    score -= 15;
    failures.push("not_actionable");
  } else {
    checks.push("actionable_hint_present");
  }

  const scenarioCombinedText = [
    reply,
    testCase.payload.cultureNote ?? "",
    ...(testCase.payload.associativePhrases ?? []),
  ].join(" ");
  if (!hasScenarioSignal(scenarioCombinedText, testCase.scenarioId)) {
    score -= 20;
    failures.push("missing_scenario_signal");
  } else {
    checks.push("scenario_signal_present");
  }

  if (testCase.payload.associativePhrases.length < 2) {
    score -= 20;
    failures.push("associative_phrases_insufficient");
  } else {
    checks.push("associative_phrases_ok");
  }

  if (
    !testCase.payload.scoreReason ||
    testCase.payload.scoreReason.trim().length < 4
  ) {
    score -= 10;
    failures.push("score_reason_weak");
  } else {
    checks.push("score_reason_ok");
  }

  return {
    id: testCase.id,
    score: Math.max(0, Math.min(100, score)),
    checks,
    failures,
  };
};
