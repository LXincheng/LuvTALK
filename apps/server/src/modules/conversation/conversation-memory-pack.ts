import { TutorInteractionMode } from "../../common/config/prompt.config";
import { LanguageCode } from "../../common/enums/language-code.enum";
import { ConversationSession } from "../../common/types/conversation.types";
import { buildSessionSummary } from "./conversation-summary.types";

const MAX_MEMORY_PACK_CHARS = 1200;
const MAX_RECENT_TURNS = 8;
const MAX_TEXT_PER_TURN = 140;

const shorten = (text: string, maxLength: number): string => {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
};

export const buildConversationMemoryPack = (params: {
  session: ConversationSession;
  interactionMode: TutorInteractionMode;
  scenarioLabel: string;
  nativeLanguage: LanguageCode;
}): string => {
  const { session, interactionMode, scenarioLabel, nativeLanguage } = params;
  const summary = buildSessionSummary({
    conversationId: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: session.messages,
  });

  const recentTurns = session.messages
    .filter((message) => message.sender === "user" || message.sender === "ai")
    .slice(-MAX_RECENT_TURNS)
    .map((message) => {
      const role = message.sender === "user" ? "learner" : "tutor";
      return `- ${role}: ${shorten(message.text, MAX_TEXT_PER_TURN)}`;
    });

  const isEnglishNative = nativeLanguage === LanguageCode.English;
  const header = isEnglishNative
    ? "MEMORY CONTEXT (session):"
    : "会话记忆上下文（session）:";
  const scenarioLine = isEnglishNative
    ? `- Scenario: ${scenarioLabel}`
    : `- 场景: ${scenarioLabel}`;
  const modeLine = isEnglishNative
    ? `- Mode: ${interactionMode}`
    : `- 模式: ${interactionMode}`;
  const turnsLine = isEnglishNative
    ? `- Turns: learner=${summary.userTurns}, tutor=${summary.aiTurns}`
    : `- 轮次: learner=${summary.userTurns}, tutor=${summary.aiTurns}`;
  const scoreLine = isEnglishNative
    ? `- Score trend: avg=${summary.averageScore ?? "n/a"}, latest=${summary.latestScore ?? "n/a"}`
    : `- 分数趋势: avg=${summary.averageScore ?? "n/a"}, latest=${summary.latestScore ?? "n/a"}`;
  const improvementLine = isEnglishNative
    ? `- Focus tips: ${summary.improvements.slice(0, 2).join(" | ") || "Keep one actionable correction per turn."}`
    : `- 重点改进: ${summary.improvements.slice(0, 2).join(" | ") || "每轮保持一个可执行纠错点。"}`;
  const nextActionLine = isEnglishNative
    ? `- Next action: ${summary.recommendedNextActions[0] ?? "Keep response concise and actionable."}`
    : `- 下一步: ${summary.recommendedNextActions[0] ?? "保持回复简洁且可执行。"}`;
  const recentHeader = isEnglishNative ? "- Recent turns:" : "- 最近对话:";

  const rawPack = [
    header,
    scenarioLine,
    modeLine,
    turnsLine,
    scoreLine,
    improvementLine,
    nextActionLine,
    recentHeader,
    ...recentTurns,
  ].join("\n");

  if (rawPack.length <= MAX_MEMORY_PACK_CHARS) {
    return rawPack;
  }
  return `${rawPack.slice(0, MAX_MEMORY_PACK_CHARS).trimEnd()}...`;
};

