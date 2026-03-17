import { LanguageCode } from "../../common/enums/language-code.enum";
import { ConversationSession } from "../../common/types/conversation.types";
import { buildConversationMemoryPack } from "./conversation-memory-pack";

const now = new Date().toISOString();

const buildSession = (): ConversationSession => ({
  id: "conv-memory-1",
  scenarioId: "daily",
  targetLanguage: LanguageCode.English,
  nativeLanguage: LanguageCode.Mandarin,
  createdAt: now,
  updatedAt: now,
  messages: [
    {
      id: "m1",
      sender: "user",
      text: "I had a busy day today.",
      language: LanguageCode.English,
      createdAt: now,
    },
    {
      id: "m2",
      sender: "ai",
      text: "Tell me one thing you want to improve tomorrow.",
      language: LanguageCode.English,
      createdAt: now,
      meta: {
        score: 76,
        scoreReason: "表达自然，建议补充细节。",
        grammarTip: "一句话先讲主干，再加细节。",
      },
    },
  ],
});

describe("buildConversationMemoryPack", () => {
  it("builds memory pack with summary and recent turns", () => {
    const pack = buildConversationMemoryPack({
      session: buildSession(),
      interactionMode: "text",
      scenarioLabel: "Daily small talk",
      nativeLanguage: LanguageCode.Mandarin,
    });

    expect(pack).toContain("会话记忆上下文");
    expect(pack).toContain("场景: Daily small talk");
    expect(pack).toContain("最近对话");
    expect(pack).toContain("- learner:");
    expect(pack).toContain("- tutor:");
  });

  it("keeps bounded length for long conversations", () => {
    const session = buildSession();
    session.messages = Array.from({ length: 40 }).map((_, index) => ({
      id: `m-${index}`,
      sender: index % 2 === 0 ? "user" : "ai",
      text: `line-${index} ${"very long content ".repeat(30)}`,
      language: LanguageCode.English,
      createdAt: now,
      ...(index % 2 === 1
        ? {
            meta: {
              score: 70,
              scoreReason: "needs more detail",
            },
          }
        : {}),
    })) as ConversationSession["messages"];

    const pack = buildConversationMemoryPack({
      session,
      interactionMode: "voice",
      scenarioLabel: "Daily small talk",
      nativeLanguage: LanguageCode.English,
    });

    expect(pack.length).toBeLessThanOrEqual(1203);
  });
});
