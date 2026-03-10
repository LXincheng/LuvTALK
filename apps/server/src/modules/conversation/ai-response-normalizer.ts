import { LanguageCode } from "../../common/enums/language-code.enum";
import {
  AiResponse,
  AiResponseSchema,
  KeyTerm,
} from "../../common/types/ai-response.schema";

interface NormalizeAiResponseOptions {
  fallbackReason: string;
  targetLanguage: LanguageCode;
}

export const normalizeAiResponsePayload = (
  payload: Record<string, unknown>,
  options: NormalizeAiResponseOptions,
): AiResponse | null => {
  const reply =
    readNonEmptyString(payload.reply) ??
    readNonEmptyString(payload.response) ??
    readNonEmptyString(payload.message);
  if (!reply) {
    return null;
  }

  const associativePhrases = ensureAssociativePhrases(
    readStringArray(payload.associativePhrases ?? payload.associative_phrases),
    options.targetLanguage,
  );
  const score = clampScore(readScore(payload.score) ?? 75);
  const scoreReason =
    readNonEmptyString(payload.scoreReason) ?? options.fallbackReason;

  const candidate = {
    reply,
    correction: readOptionalString(payload.correction),
    cultureNote: readOptionalString(payload.cultureNote),
    associativePhrases,
    score,
    scoreReason,
    pronunciationTip: readTip(payload.pronunciationTip),
    rhythmTip: readTip(payload.rhythmTip),
    grammarTip: readTip(payload.grammarTip),
    keyTerms: readKeyTerms(payload.keyTerms ?? payload.key_terms),
  };

  const parsed = AiResponseSchema.safeParse(candidate);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
};

const readNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized ? normalized : undefined;
};

const readOptionalString = (value: unknown): string | undefined => {
  return readNonEmptyString(value);
};

const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
};

const readScore = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const numeric = Number(value.trim());
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return undefined;
};

const clampScore = (value: number): number => {
  return Math.min(100, Math.max(0, Math.round(value)));
};

const ensureAssociativePhrases = (
  phrases: string[],
  targetLanguage: LanguageCode,
): string[] => {
  const normalized = phrases.slice(0, 4);
  const fallback = fallbackAssociativePhrases(targetLanguage);
  while (normalized.length < 2) {
    normalized.push(fallback[normalized.length]);
  }
  return normalized.slice(0, 4);
};

const fallbackAssociativePhrases = (
  targetLanguage: LanguageCode,
): [string, string] => {
  switch (targetLanguage) {
    case LanguageCode.English:
      return [
        "Could you say that again a little more naturally?",
        "Try adding one more detail in your next sentence.",
      ];
    case LanguageCode.Cantonese:
      return ["你可唔可以再自然噉讲一次？", "下一句可以再加一个细节。"];
    case LanguageCode.Mandarin:
    default:
      return ["你可以再自然地说一遍吗？", "下一句可以再补充一个细节。"];
  }
};

const readTip = (value: unknown): string | undefined => {
  const tip = readNonEmptyString(value);
  if (!tip) {
    return undefined;
  }
  return keepFirstSentence(tip, 120);
};

const keepFirstSentence = (text: string, maxLength: number): string => {
  const firstSentence = text
    .split(/(?<=[。！？!?.])\s+/u)
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  const selected = firstSentence ?? text.trim();
  if (selected.length <= maxLength) {
    return selected;
  }
  return `${selected.slice(0, maxLength).trimEnd()}...`;
};

const readKeyTerms = (value: unknown): KeyTerm[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const term = readNonEmptyString(record.term);
      if (!term) {
        return null;
      }
      const definition = readOptionalString(record.definition) ?? "";
      const type = readOptionalString(record.type);
      const examples = readStringArray(record.examples ?? record.example).slice(
        0,
        2,
      );
      return {
        term,
        definition,
        ...(type ? { type } : {}),
        examples,
      };
    })
    .filter((item): item is KeyTerm => item !== null)
    .slice(0, 5);
};
