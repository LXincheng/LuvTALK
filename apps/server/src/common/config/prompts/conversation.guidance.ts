import { LanguageCode } from "../../enums/language-code.enum";
import { describeLanguage } from "./prompt.shared";
import type { TutorInteractionMode } from "./prompt.types";
import { resolveScenarioLabel } from "./scenario.config";

export interface ConversationTeachingTips {
  correction: string;
  cultureNote: string;
  pronunciationTip: string;
  rhythmTip: string;
  grammarTip: string;
}

const isEnglishQuestion = (text?: string): boolean => {
  if (!text) {
    return false;
  }
  const trimmed = text.trim();
  return (
    /[?？]$/.test(trimmed) ||
    /^(what|when|where|which|how|can|could|would|do|did|are|is)\b/i.test(
      trimmed,
    )
  );
};

const compactTopic = (text?: string): string | undefined => {
  if (!text) {
    return undefined;
  }
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return undefined;
  }
  return normalized.length > 28
    ? `${normalized.slice(0, 28).trimEnd()}...`
    : normalized;
};

export const buildDefaultTeachingTips = (params: {
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  interactionMode: TutorInteractionMode;
  scenarioId: string;
}): ConversationTeachingTips => {
  const { targetLanguage, nativeLanguage, interactionMode, scenarioId } =
    params;
  const targetLabel = describeLanguage(targetLanguage);
  const scenarioLabel = resolveScenarioLabel(scenarioId, nativeLanguage);

  if (nativeLanguage === LanguageCode.English) {
    return {
      correction:
        interactionMode === "voice"
          ? `In ${scenarioLabel}, use one shorter ${targetLabel} sentence first, then add details in the next turn.`
          : `For ${scenarioLabel}, polish one sentence in ${targetLabel} first, and keep the next sentence concise.`,
      cultureNote:
        interactionMode === "voice"
          ? `In ${scenarioLabel}, start with one positive phrase before asking a question to sound natural.`
          : `In ${scenarioLabel}, add one friendly acknowledgement before your request.`,
      pronunciationTip:
        "Slow down the stressed syllables and keep ending consonants clear.",
      rhythmTip:
        "Pause briefly after each clause instead of speaking in one long breath.",
      grammarTip:
        "Prefer one tense in one sentence; avoid mixing structures in the same turn.",
    };
  }

  if (nativeLanguage === LanguageCode.Cantonese) {
    return {
      correction:
        interactionMode === "voice"
          ? `喺${scenarioLabel}場景入面，先用一句更短嘅${targetLabel}講清重點，再補充細節。`
          : `喺${scenarioLabel}場景入面，先完整講一句${targetLabel}核心表達，再用下一句補充資訊。`,
      cultureNote:
        interactionMode === "voice"
          ? `喺${scenarioLabel}入面，先肯定對方再追問，會更似真實口語互動。`
          : `喺${scenarioLabel}入面，先簡短回應再講需求，會更似母語者節奏。`,
      pronunciationTip: "重讀關鍵詞，句尾輔音收清楚，語氣會自然好多。",
      rhythmTip: "按意群做短停頓，唔好一口氣讀完整句。",
      grammarTip: "一句只保留一個主結構，避免時態同句式混用。",
    };
  }

  return {
    correction:
      interactionMode === "voice"
        ? `在${scenarioLabel}场景中，先用一句更短的${targetLabel}表达核心意思，再补充细节。`
        : `在${scenarioLabel}场景中，先把一句${targetLabel}核心表达说完整，再用下一句补充信息。`,
    cultureNote:
      interactionMode === "voice"
        ? `在${scenarioLabel}里先肯定对方再提出问题，会更像真实口语互动。`
        : `在${scenarioLabel}里先做简短回应再表达需求，更符合母语者交流习惯。`,
    pronunciationTip: "重读关键词，句尾辅音收清楚，语气会更自然。",
    rhythmTip: "按意群做短停顿，不要一口气读完整句。",
    grammarTip: "一句话只保留一个主结构，避免时态和句式混用。",
  };
};

export const ensureScenarioTeachingReply = (params: {
  reply: string;
  targetLanguage: LanguageCode;
  scenarioId: string;
  latestMessage: string;
}): string => {
  const { reply, targetLanguage, scenarioId, latestMessage } = params;
  const trimmed = reply.trim();
  if (trimmed.length >= 28) {
    return trimmed;
  }

  const scenarioLabel = resolveScenarioLabel(scenarioId, targetLanguage);
  if (targetLanguage === LanguageCode.English) {
    return `${trimmed} In this ${scenarioLabel} context, try: "${latestMessage}" with one clearer key phrase and a follow-up question.`;
  }
  if (targetLanguage === LanguageCode.Cantonese) {
    return `${trimmed} 喺${scenarioLabel}呢個場景，你可以先講重點，再加一句追問，令對話更自然。`;
  }
  return `${trimmed} 在${scenarioLabel}场景里，你可以先说重点，再补一句追问，让表达更像母语者。`;
};

export const buildDynamicScenarioGuidance = (params: {
  primaryPhrase: string;
  secondaryPhrase: string;
  nativeLanguage: LanguageCode;
  lastAiText?: string;
  lastUserText?: string;
}): string[] => {
  const {
    primaryPhrase,
    secondaryPhrase,
    nativeLanguage,
    lastAiText,
    lastUserText,
  } = params;
  const topic = compactTopic(lastUserText ?? lastAiText);

  if (nativeLanguage === LanguageCode.English) {
    return [
      primaryPhrase,
      secondaryPhrase,
      topic
        ? `About ${topic}, I want to confirm one more detail.`
        : "I want to confirm one more detail before we finish.",
    ];
  }

  if (nativeLanguage === LanguageCode.Cantonese) {
    return [
      primaryPhrase,
      secondaryPhrase,
      topic ? `關於${topic}，我想再確認一個細節。` : "我想再確認一個細節。",
    ];
  }

  return [
    primaryPhrase,
    secondaryPhrase,
    topic ? `关于${topic}，我想再确认一个细节。` : "我想再确认一个细节。",
  ];
};

export const buildScenarioHintMessage = (params: {
  scenarioId: string;
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  userTurns: number;
  lastAiText?: string;
  lastUserText?: string;
}): string => {
  const {
    scenarioId,
    targetLanguage,
    nativeLanguage,
    userTurns,
    lastAiText,
    lastUserText,
  } = params;
  const scenarioLabel = resolveScenarioLabel(scenarioId, nativeLanguage);
  const targetLabel = describeLanguage(targetLanguage);
  const aiAskedQuestion = isEnglishQuestion(lastAiText);
  const alreadyGaveDetail = Boolean(
    lastUserText && lastUserText.trim().length >= 18,
  );

  if (nativeLanguage === LanguageCode.English) {
    if (userTurns === 0) {
      return `Stay inside the ${scenarioLabel} scene. Start with one short ${targetLabel} sentence, then add one concrete detail.`;
    }
    if (aiAskedQuestion) {
      return `Keep the ${scenarioLabel} flow. Answer the question first, then add one useful detail instead of opening a new topic.`;
    }
    if (alreadyGaveDetail) {
      return "Your next line can be shorter. Confirm the key point, then close with a small request or follow-up.";
    }
    return `Stay in the ${scenarioLabel} context. Say the key information first, then add one small detail that moves the task forward.`;
  }

  if (nativeLanguage === LanguageCode.Cantonese) {
    if (userTurns === 0) {
      return `先留喺${scenarioLabel}呢個場景。先用一句簡短嘅${targetLabel}講清核心信息，再補一個具體細節。`;
    }
    if (aiAskedQuestion) {
      return `繼續留喺${scenarioLabel}場景。先直接回應對方問題，再補一個有用信息，唔好突然轉話題。`;
    }
    if (alreadyGaveDetail) {
      return "你下一句可以再短啲。先確認重點，再順勢補一個小要求或者追問。";
    }
    return `繼續留喺${scenarioLabel}呢個任務。先講重點，再補一個可以推動場景繼續落去嘅小細節。`;
  }

  if (userTurns === 0) {
    return `先留在${scenarioLabel}这个场景里。先用一句简短的${targetLabel}说清核心信息，再补一个具体细节。`;
  }
  if (aiAskedQuestion) {
    return `继续留在${scenarioLabel}场景里。先直接回应对方的问题，再补一个有用信息，不要突然换话题。`;
  }
  if (alreadyGaveDetail) {
    return "你下一句可以更短一些。先确认重点，再顺势补一个小请求或追问。";
  }
  return `继续留在${scenarioLabel}这个任务里。先说重点，再补一个能推动场景往下走的小细节。`;
};
