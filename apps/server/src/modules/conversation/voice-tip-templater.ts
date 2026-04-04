import { LanguageCode } from "../../common/enums/language-code.enum";

const ACTION_TOKENS_EN = ["try", "focus", "keep", "start", "pause", "stress"];
const ACTION_TOKENS_ZH = [
  "先",
  "再",
  "注意",
  "建议",
  "尝试",
  "保持",
  "重读",
  "停顿",
];
const GENERIC_EN_PATTERNS = [
  /\bgood job\b/i,
  /\blooks good\b/i,
  /\bkeep it up\b/i,
  /\bwell done\b/i,
  /\bnice\b/i,
];
const GENERIC_ZH_PATTERNS = [/做得好/, /不错/, /继续加油/, /很好/];

type TipKind = "pronunciation" | "rhythm" | "grammar";

interface VoiceTipOptions {
  scenarioId?: string;
  kind: TipKind;
}

const keepFirstSentence = (text: string, maxLength = 96): string => {
  const sentence = text
    .split(/(?<=[。！？!?.])\s+/u)
    .map((item) => item.trim())
    .find((item) => item.length > 0);
  const selected = sentence ?? text.trim();
  if (selected.length <= maxLength) {
    return selected;
  }
  return `${selected.slice(0, maxLength).trimEnd()}...`;
};

const normalizeSpacing = (text: string): string => {
  return text.replace(/\s+/g, " ").trim();
};

const isGenericTip = (text: string, nativeLanguage: LanguageCode): boolean => {
  if (!text) {
    return true;
  }
  if (nativeLanguage === LanguageCode.English) {
    return GENERIC_EN_PATTERNS.some((pattern) => pattern.test(text));
  }
  return GENERIC_ZH_PATTERNS.some((pattern) => pattern.test(text));
};

const hasActionHint = (text: string, nativeLanguage: LanguageCode): boolean => {
  const normalized = text.toLowerCase();
  if (nativeLanguage === LanguageCode.English) {
    return ACTION_TOKENS_EN.some((token) => normalized.includes(token));
  }
  return ACTION_TOKENS_ZH.some((token) => text.includes(token));
};

const ensureActionablePrefix = (
  text: string,
  nativeLanguage: LanguageCode,
): string => {
  if (!text) {
    return text;
  }
  if (hasActionHint(text, nativeLanguage)) {
    return text;
  }
  if (nativeLanguage === LanguageCode.English) {
    return `Try this: ${text}`;
  }
  return `建议：${text}`;
};

const applyKindHint = (
  text: string,
  nativeLanguage: LanguageCode,
  kind: TipKind,
): string => {
  if (!text) {
    return text;
  }
  if (nativeLanguage === LanguageCode.English) {
    const hint =
      kind === "pronunciation"
        ? "focus on one stressed word"
        : kind === "rhythm"
          ? "pause once at clause boundary"
          : "use one clean sentence pattern";
    if (text.toLowerCase().includes(hint)) {
      return text;
    }
    return `${text}; ${hint}.`;
  }
  const hint =
    kind === "pronunciation"
      ? "重点重读一个关键词"
      : kind === "rhythm"
        ? "在意群边界做一次短停顿"
        : "一句话只保留一个主结构";
  if (text.includes(hint)) {
    return text;
  }
  return `${text}；${hint}。`;
};

export const toVoiceMicroTip = (
  raw: string | undefined,
  nativeLanguage: LanguageCode,
  options?: VoiceTipOptions,
): string | undefined => {
  const trimmed = normalizeSpacing(raw ?? "");
  if (!trimmed) {
    return undefined;
  }
  if (isGenericTip(trimmed, nativeLanguage)) {
    return undefined;
  }
  const oneSentence = keepFirstSentence(trimmed);
  const actionable = ensureActionablePrefix(oneSentence, nativeLanguage);
  return applyKindHint(
    actionable,
    nativeLanguage,
    options?.kind ?? "pronunciation",
  );
};

export const ensureVoiceTipSet = (
  input: {
    pronunciationTip?: string;
    rhythmTip?: string;
    grammarTip?: string;
  },
  fallback: {
    pronunciationTip: string;
    rhythmTip: string;
    grammarTip: string;
  },
  nativeLanguage: LanguageCode,
  options?: { scenarioId?: string },
): {
  pronunciationTip?: string;
  rhythmTip?: string;
  grammarTip?: string;
} => {
  const pronunciationTip =
    toVoiceMicroTip(input.pronunciationTip, nativeLanguage, {
      scenarioId: options?.scenarioId,
      kind: "pronunciation",
    }) ??
    toVoiceMicroTip(fallback.pronunciationTip, nativeLanguage, {
      scenarioId: options?.scenarioId,
      kind: "pronunciation",
    });
  const rhythmTip =
    toVoiceMicroTip(input.rhythmTip, nativeLanguage, {
      scenarioId: options?.scenarioId,
      kind: "rhythm",
    }) ??
    toVoiceMicroTip(fallback.rhythmTip, nativeLanguage, {
      scenarioId: options?.scenarioId,
      kind: "rhythm",
    });
  const grammarTip =
    toVoiceMicroTip(input.grammarTip, nativeLanguage, {
      scenarioId: options?.scenarioId,
      kind: "grammar",
    }) ??
    toVoiceMicroTip(fallback.grammarTip, nativeLanguage, {
      scenarioId: options?.scenarioId,
      kind: "grammar",
    });

  return {
    pronunciationTip,
    rhythmTip,
    grammarTip,
  };
};
