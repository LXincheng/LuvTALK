import { ConversationMessage } from "../../common/types/conversation.types";

export interface LearningGoalProgressWindow {
  dailyMinutes: number;
  weeklyWords: number;
  weeklySpeaking: number;
}

const DAILY_MINUTES_PER_WORD = 1 / 45;
const DAILY_SPEAKING_BONUS = 0.75;

const normalizeToken = (token: string): string =>
  token
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']/gu, "")
    .trim();

const extractTokens = (text: string): string[] => {
  return text
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length >= 2);
};

const isSpeakingMessage = (message: ConversationMessage): boolean => {
  return Boolean(message.meta?.audioUrl) || message.meta?.source === "realtime";
};

const toSafeDate = (value: string): Date | null => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

export function computeLearningGoalProgress(
  messages: ConversationMessage[],
  now: Date,
): LearningGoalProgressWindow {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(dayStart);
  weekStart.setDate(weekStart.getDate() - 6);

  let dailyWords = 0;
  let dailySpeakingTurns = 0;
  let weeklySpeakingTurns = 0;
  const weeklyVocabulary = new Set<string>();

  messages.forEach((message) => {
    if (message.sender !== "user") {
      return;
    }
    const messageTime = toSafeDate(message.createdAt);
    if (!messageTime || messageTime < weekStart || messageTime > now) {
      return;
    }

    const tokens = extractTokens(message.text);
    tokens.forEach((token) => weeklyVocabulary.add(token));

    if (isSpeakingMessage(message)) {
      weeklySpeakingTurns += 1;
    }

    if (messageTime >= dayStart) {
      dailyWords += tokens.length;
      if (isSpeakingMessage(message)) {
        dailySpeakingTurns += 1;
      }
    }
  });

  const estimatedDailyMinutes = Math.max(
    0,
    Math.round(
      dailyWords * DAILY_MINUTES_PER_WORD +
        dailySpeakingTurns * DAILY_SPEAKING_BONUS,
    ),
  );

  return {
    dailyMinutes: estimatedDailyMinutes,
    weeklyWords: weeklyVocabulary.size,
    weeklySpeaking: weeklySpeakingTurns,
  };
}

export function mergeFocusMinutesIntoProgress(
  progress: LearningGoalProgressWindow,
  focusSeconds: number,
): LearningGoalProgressWindow {
  const focusMinutes = Math.max(0, Math.floor(focusSeconds / 60));
  return {
    ...progress,
    dailyMinutes: progress.dailyMinutes + focusMinutes,
  };
}
