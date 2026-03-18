import { LanguageCode } from "../../common/enums/language-code.enum";

const MAX_TTS_CHARS = 320;
const STUDY_SECTION_PATTERN = /(\n|^)\s*(学习建议|Study Steps)[:：]/i;
const LIST_LINE_PATTERN = /^\s*(\d+[).]|[-*•])\s*/gm;
const LIST_INLINE_PATTERN = /(?:^|\s)(\d+[).]|[-*•])\s+/g;
const SPACE_AFTER_PUNCT_PATTERN = /\s*([,，;；:：])\s*/g;
const SPACE_AFTER_ENDING_PATTERN = /\s*([。！？!?])\s*/g;

type ScenarioId =
  | "restaurant"
  | "shopping"
  | "directions"
  | "business"
  | "daily";

interface ProsodyStyle {
  pauseJoiner: string;
  maxChars: number;
  longLineThreshold: number;
}

const SCENARIO_STYLE: Record<ScenarioId, ProsodyStyle> = {
  restaurant: {
    pauseJoiner: ", ",
    maxChars: 300,
    longLineThreshold: 92,
  },
  shopping: {
    pauseJoiner: ", ",
    maxChars: 300,
    longLineThreshold: 90,
  },
  directions: {
    pauseJoiner: ", then ",
    maxChars: 290,
    longLineThreshold: 84,
  },
  business: {
    pauseJoiner: "; ",
    maxChars: 280,
    longLineThreshold: 78,
  },
  daily: {
    pauseJoiner: ", ",
    maxChars: MAX_TTS_CHARS,
    longLineThreshold: 96,
  },
};

const stripMarkdownNoise = (text: string): string => {
  return text
    .replace(/[`*_#>|~]/g, " ")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(LIST_LINE_PATTERN, "")
    .replace(LIST_INLINE_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const splitLongLine = (input: string, style: ProsodyStyle): string => {
  if (input.length <= style.longLineThreshold) {
    return input;
  }
  const midpoint = Math.floor(input.length / 2);
  const left = input.lastIndexOf(" ", midpoint);
  const right = input.indexOf(" ", midpoint);
  const splitAt = left > 0 ? left : right > 0 ? right : -1;
  if (splitAt <= 0) {
    return input;
  }
  return `${input.slice(0, splitAt).trim()}${style.pauseJoiner}${input.slice(splitAt + 1).trim()}`;
};

const resolveScenarioStyle = (scenarioId?: string): ProsodyStyle => {
  if (!scenarioId) {
    return SCENARIO_STYLE.daily;
  }
  return SCENARIO_STYLE[scenarioId as ScenarioId] ?? SCENARIO_STYLE.daily;
};

const stripLeadInFillers = (input: string): string => {
  return input
    .replace(
      /^(好的|好呀|当然|没问题|ok|okay|sure|great|alright)[,，!！.\s]+/i,
      "",
    )
    .trim();
};

export const extractPrimarySpokenSegment = (text: string): string => {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }
  const sectionMatch = normalized.match(STUDY_SECTION_PATTERN);
  if (!sectionMatch?.index) {
    return normalized;
  }
  return normalized.slice(0, sectionMatch.index).trim();
};

export const buildProsodyReadyTtsInput = (
  rawText: string,
  language?: LanguageCode | string,
  scenarioId?: string,
): string => {
  const style = resolveScenarioStyle(scenarioId);
  const spoken = extractPrimarySpokenSegment(rawText);
  const cleaned = stripLeadInFillers(stripMarkdownNoise(spoken || rawText));
  if (!cleaned) {
    return rawText.trim();
  }

  let result = cleaned
    .replace(SPACE_AFTER_PUNCT_PATTERN, "$1 ")
    .replace(SPACE_AFTER_ENDING_PATTERN, "$1 ");

  result = splitLongLine(result, style);

  if (language === LanguageCode.English || language === "en") {
    // Make question intonation more natural while keeping text plain.
    result = result.replace(/\?\s*/g, "? ... ");
  } else {
    result = result.replace(/？\s*/g, "？ ... ");
  }

  result = result.replace(/\s+/g, " ").trim();
  if (result.length <= style.maxChars) {
    return result;
  }
  return `${result.slice(0, style.maxChars).trimEnd()}...`;
};
