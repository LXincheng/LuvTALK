import { LanguageCode } from "../../common/enums/language-code.enum";
import { ConversationMessage } from "../../common/types/conversation.types";
import { buildSessionSummary } from "./conversation-summary.types";

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

describe("buildSessionSummary", () => {
  it("builds summary with scores, suggestions and terms", () => {
    const summary = buildSessionSummary({
      conversationId: "conv-1",
      createdAt: "2026-02-28T09:00:00.000Z",
      updatedAt: "2026-02-28T09:12:00.000Z",
      messages: [
        buildMessage({
          sender: "user",
          text: "hello there",
          createdAt: "2026-02-28T09:01:00.000Z",
        }),
        buildMessage({
          sender: "ai",
          text: "reply",
          createdAt: "2026-02-28T09:02:00.000Z",
          meta: {
            score: 72,
            pronunciationTip: "发音需要更清晰",
            keyTerms: [
              {
                term: 'g"day',
                definition: "hello",
                examples: [],
              },
            ],
          },
        }),
      ],
    });

    expect(summary.durationMinutes).toBe(1);
    expect(summary.userTurns).toBe(1);
    expect(summary.aiTurns).toBe(1);
    expect(summary.averageScore).toBe(72);
    expect(summary.latestScore).toBe(72);
    expect(summary.headline.length).toBeGreaterThan(0);
    expect(summary.advice.length).toBeGreaterThan(0);
    expect(summary.improvements.length).toBeGreaterThan(0);
    expect(summary.recommendedNextActions.length).toBeGreaterThan(0);
    expect(summary.keyTerms.length).toBe(1);
  });

  it("returns fallback strengths when data is sparse", () => {
    const summary = buildSessionSummary({
      conversationId: "conv-2",
      createdAt: "2026-02-28T09:00:00.000Z",
      updatedAt: "2026-02-28T09:00:10.000Z",
      messages: [],
    });

    expect(summary.durationMinutes).toBe(1);
    expect(summary.headline).toContain("目标语言语境");
    expect(summary.recommendedNextActions.length).toBe(1);
  });
});
