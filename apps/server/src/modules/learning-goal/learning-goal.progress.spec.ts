import { ConversationMessage } from "../../common/types/conversation.types";
import { LanguageCode } from "../../common/enums/language-code.enum";
import {
  computeLearningGoalProgress,
  mergeFocusMinutesIntoProgress,
} from "./learning-goal.progress";

const buildMessage = (
  payload: Partial<ConversationMessage> &
    Pick<ConversationMessage, "sender" | "text" | "createdAt">,
): ConversationMessage => ({
  id: payload.id ?? "msg-id",
  sender: payload.sender,
  text: payload.text,
  language: payload.language ?? LanguageCode.English,
  createdAt: payload.createdAt,
  meta: payload.meta,
});

describe("computeLearningGoalProgress", () => {
  const now = new Date("2026-03-01T10:00:00.000Z");

  it("counts unique weekly vocabulary and daily minutes", () => {
    const messages: ConversationMessage[] = [
      buildMessage({
        sender: "user",
        text: "hello world hello tutor",
        createdAt: "2026-03-01T08:00:00.000Z",
      }),
      buildMessage({
        sender: "user",
        text: "practice makes progress",
        createdAt: "2026-02-27T08:00:00.000Z",
      }),
    ];

    const result = computeLearningGoalProgress(messages, now);
    expect(result.weeklyWords).toBe(6);
    expect(result.dailyMinutes).toBe(0);
    expect(result.weeklySpeaking).toBe(0);
  });

  it("counts speaking turns from audio and realtime source", () => {
    const messages: ConversationMessage[] = [
      buildMessage({
        sender: "user",
        text: "voice one",
        createdAt: "2026-03-01T07:00:00.000Z",
        meta: { audioUrl: "/x.mp3" },
      }),
      buildMessage({
        sender: "user",
        text: "voice two",
        createdAt: "2026-02-28T07:00:00.000Z",
        meta: { source: "realtime" },
      }),
    ];

    const result = computeLearningGoalProgress(messages, now);
    expect(result.weeklySpeaking).toBe(2);
    expect(result.dailyMinutes).toBe(1);
  });

  it("ignores ai messages and out-of-window messages", () => {
    const messages: ConversationMessage[] = [
      buildMessage({
        sender: "ai",
        text: "ignored",
        createdAt: "2026-03-01T07:00:00.000Z",
      }),
      buildMessage({
        sender: "user",
        text: "old message",
        createdAt: "2026-02-20T07:00:00.000Z",
      }),
      buildMessage({
        sender: "user",
        text: "future message",
        createdAt: "2026-03-02T07:00:00.000Z",
      }),
    ];

    const result = computeLearningGoalProgress(messages, now);
    expect(result.dailyMinutes).toBe(0);
    expect(result.weeklyWords).toBe(0);
    expect(result.weeklySpeaking).toBe(0);
  });

  it("keeps apostrophe words and strips punctuation", () => {
    const messages: ConversationMessage[] = [
      buildMessage({
        sender: "user",
        text: "It's learner's-time, now!",
        createdAt: "2026-03-01T06:00:00.000Z",
      }),
    ];

    const result = computeLearningGoalProgress(messages, now);
    expect(result.weeklyWords).toBe(3);
  });

  it("adds persisted focus minutes into daily progress", () => {
    const progress = {
      dailyMinutes: 3,
      weeklyWords: 10,
      weeklySpeaking: 2,
    };
    const merged = mergeFocusMinutesIntoProgress(progress, 179);
    expect(merged.dailyMinutes).toBe(5);
    expect(merged.weeklyWords).toBe(10);
    expect(merged.weeklySpeaking).toBe(2);
  });
});
