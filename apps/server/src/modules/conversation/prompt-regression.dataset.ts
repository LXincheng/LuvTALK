import { LanguageCode } from "../../common/enums/language-code.enum";
import { AiResponse } from "../../common/types/ai-response.schema";
import { PromptRegressionCase } from "./prompt-regression.types";

const buildPayload = (input: Partial<AiResponse> & Pick<AiResponse, "reply">): AiResponse => {
  return {
    reply: input.reply,
    correction: input.correction ?? "",
    cultureNote: input.cultureNote ?? "",
    associativePhrases:
      input.associativePhrases ?? ["Could you tell me more about that?", "What should I do next?"],
    score: input.score ?? 78,
    scoreReason: input.scoreReason ?? "Detected mixed language usage; encourage one clearer target-language sentence.",
    pronunciationTip: input.pronunciationTip ?? "",
    rhythmTip: input.rhythmTip ?? "",
    grammarTip: input.grammarTip ?? "",
    keyTerms: input.keyTerms ?? [],
  };
};

interface ScenarioTemplate {
  id: string;
  latestUserMessage: string;
  targetSentence: string;
  associativePhrases: [string, string];
  cultureCn: string;
  cultureEn: string;
}

const SCENARIOS: ScenarioTemplate[] = [
  {
    id: "restaurant",
    latestUserMessage: "I want something light.",
    targetSentence: "I would like something light but flavorful from the menu.",
    associativePhrases: [
      "Could you recommend your signature dish?",
      "I'd like something light but flavorful.",
    ],
    cultureCn: "点餐时先表示感谢再提需求，会更礼貌。",
    cultureEn: "In restaurants, a brief thanks before requests sounds more natural.",
  },
  {
    id: "directions",
    latestUserMessage: "How can I get to the station?",
    targetSentence: "Could you show me the fastest route to the station?",
    associativePhrases: [
      "Could you show me the fastest route?",
      "Is it within walking distance from here?",
    ],
    cultureCn: "问路时先说目的地，再问路线效率更高。",
    cultureEn: "When asking directions, name destination first, then ask route options.",
  },
  {
    id: "business",
    latestUserMessage: "Can we move this faster?",
    targetSentence: "Could we align on the next action and timeline today?",
    associativePhrases: [
      "Could we align on the next action today?",
      "Let's confirm the timeline before we proceed.",
    ],
    cultureCn: "商务沟通先对齐行动项，再确认时间线。",
    cultureEn: "In business talk, align actions first, then confirm timeline.",
  },
  {
    id: "daily",
    latestUserMessage: "I had a busy day.",
    targetSentence: "That sounds busy. Tell me one thing you want to improve tomorrow.",
    associativePhrases: [
      "What was the busiest part of your day?",
      "What do you want to improve tomorrow?",
    ],
    cultureCn: "日常交流先回应情绪，再追问细节更自然。",
    cultureEn: "In daily chat, acknowledge emotion first, then ask details.",
  },
];

const VARIANT_COUNT = 8;

const createTextCase = (
  scenario: ScenarioTemplate,
  nativeLanguage: LanguageCode,
  variantIndex: number,
): PromptRegressionCase => {
  const caseId = `text_${scenario.id}_${nativeLanguage}_${String(variantIndex + 1).padStart(3, "0")}`;
  const reply =
    nativeLanguage === LanguageCode.English
      ? `${scenario.targetSentence}\n\nStudy Steps:\n1. Start with the main intent, then add one specific detail.\n2. Then use one follow-up question to keep the conversation moving.`
      : `${scenario.targetSentence}\n\n学习建议:\n1. 先说核心意图，再补充一个具体细节。\n2. 再加一句追问，让对话自然推进。`;
  const correction =
    nativeLanguage === LanguageCode.English
      ? "Try one complete sentence first, then add one concrete detail."
      : "先用完整句表达核心，再补一个具体信息会更自然。";
  const grammarTip =
    nativeLanguage === LanguageCode.English
      ? "Use one clause per intent to keep structure clear."
      : "建议一句只保留一个主结构，避免信息堆叠。";

  return {
    id: caseId,
    title: `text mode ${scenario.id} case ${variantIndex + 1}`,
    interactionMode: "text",
    nativeLanguage,
    scenarioId: scenario.id,
    latestUserMessage: scenario.latestUserMessage,
    payload: buildPayload({
      reply,
      correction,
      cultureNote:
        nativeLanguage === LanguageCode.English ? scenario.cultureEn : scenario.cultureCn,
      associativePhrases: scenario.associativePhrases,
      grammarTip,
      scoreReason:
        nativeLanguage === LanguageCode.English
          ? "Detected understandable intent; next step is clearer structure and flow."
          : "检测到表达意图清晰，下一步提升结构与衔接。",
      score: 76 + (variantIndex % 6),
    }),
    expectedMinScore: 80,
  };
};

const createVoiceCase = (
  scenario: ScenarioTemplate,
  nativeLanguage: LanguageCode,
  variantIndex: number,
): PromptRegressionCase => {
  const caseId = `voice_${scenario.id}_${nativeLanguage}_${String(variantIndex + 1).padStart(3, "0")}`;
  const correction =
    nativeLanguage === LanguageCode.English
      ? "Start with one clear idea, then ask one short follow-up question."
      : "先说一个清晰重点，再补一个简短追问。";
  const pronunciationTip =
    nativeLanguage === LanguageCode.English
      ? "Focus on stressed syllables and keep final consonants clear."
      : "注意关键词重读，句尾辅音收清楚。";
  const grammarTip =
    nativeLanguage === LanguageCode.English
      ? "Keep one tense consistent in each spoken line."
      : "建议每句话保持单一时态与结构。";

  return {
    id: caseId,
    title: `voice mode ${scenario.id} case ${variantIndex + 1}`,
    interactionMode: "voice",
    nativeLanguage,
    scenarioId: scenario.id,
    latestUserMessage: scenario.latestUserMessage,
    payload: buildPayload({
      reply: scenario.targetSentence,
      correction,
      pronunciationTip,
      grammarTip,
      cultureNote:
        nativeLanguage === LanguageCode.English ? scenario.cultureEn : scenario.cultureCn,
      associativePhrases: scenario.associativePhrases,
      scoreReason:
        nativeLanguage === LanguageCode.English
          ? "Spoken response is natural; keep pacing and structure stable."
          : "口语回复自然，继续保持节奏与结构稳定。",
      score: 74 + (variantIndex % 7),
    }),
    expectedMinScore: 75,
  };
};

const positiveCases: PromptRegressionCase[] = SCENARIOS.flatMap((scenario) =>
  Array.from({ length: VARIANT_COUNT }).flatMap((_, index) => [
    createTextCase(scenario, LanguageCode.Mandarin, index),
    createTextCase(scenario, LanguageCode.English, index),
    createVoiceCase(scenario, LanguageCode.Mandarin, index),
    createVoiceCase(scenario, LanguageCode.English, index),
  ]),
);

const negativeCases: PromptRegressionCase[] = [
  {
    id: "text_weak_generic_001",
    title: "generic text reply should fail structured checks",
    interactionMode: "text",
    nativeLanguage: LanguageCode.Mandarin,
    scenarioId: "restaurant",
    latestUserMessage: "I want noodles.",
    payload: buildPayload({
      reply: "Good job.",
      correction: "",
      cultureNote: "",
      associativePhrases: ["Okay.", "Sure."],
      scoreReason: "good",
    }),
    expectedMinScore: 0,
    requiredFailures: ["reply_too_short", "text_missing_study_steps", "not_actionable"],
  },
  {
    id: "voice_no_tip_001",
    title: "voice reply without any teaching tip should fail",
    interactionMode: "voice",
    nativeLanguage: LanguageCode.English,
    scenarioId: "business",
    latestUserMessage: "Can we align this today?",
    payload: buildPayload({
      reply: "Let's align this today and close the plan.",
      correction: "",
      pronunciationTip: "",
      rhythmTip: "",
      grammarTip: "",
      cultureNote: "Business context needs clear actions.",
      associativePhrases: ["Could we align on the next action today?", "Let's confirm the timeline before we proceed."],
      scoreReason: "clear",
    }),
    expectedMinScore: 0,
    requiredFailures: ["missing_teaching_tip"],
  },
  {
    id: "text_no_scenario_001",
    title: "text reply without scenario signals should fail",
    interactionMode: "text",
    nativeLanguage: LanguageCode.English,
    scenarioId: "directions",
    latestUserMessage: "How do I get there?",
    payload: buildPayload({
      reply:
        "Let's practice a clearer sentence.\n\nStudy Steps:\n1. Start with one clear sentence.\n2. Then ask one follow-up question.",
      correction: "Try one complete sentence first, then add one detail.",
      cultureNote: "Keep your tone polite and clear.",
      associativePhrases: ["Tell me more.", "Could you repeat that?"],
      scoreReason: "clear enough",
    }),
    expectedMinScore: 0,
    requiredFailures: ["missing_scenario_signal"],
  },
];

export const PROMPT_REGRESSION_CASES: PromptRegressionCase[] = [
  ...positiveCases,
  ...negativeCases,
];
