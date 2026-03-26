import { ReviewService } from "./review.service";
import type {
  ConversationMessage,
  FavoriteItem,
} from "../../common/types/conversation.types";
import { FavoriteTypeEnum } from "../../common/enums/favorite-type.enum";
import { LanguageCode } from "../../common/enums/language-code.enum";

const createService = () =>
  new ReviewService(
    { list: jest.fn() } as never,
    {} as never,
    { queueUserProgressSync: jest.fn() } as never,
    { listCachedSessions: jest.fn(() => []) } as never,
  );

describe("ReviewService", () => {
  it("filters out placeholder-like favorite cards", () => {
    const service = createService() as unknown as {
      buildFavoriteCards: (favorites: FavoriteItem[]) => unknown[];
    };

    const cards = service.buildFavoriteCards([
      {
        id: "fav-1",
        type: FavoriteTypeEnum.Vocabulary,
        title: "test",
        content:
          "our sentence is in English but it’s just a test phrase with no real content to practice",
        createdAt: new Date().toISOString(),
      },
    ]);

    expect(cards).toEqual([]);
  });

  it("prefers key terms with definition and example for low-score cards", () => {
    const service = createService() as unknown as {
      extractLowScoreCards: (
        conversationId: string,
        messages: ConversationMessage[],
      ) => Array<{
        term: string;
        definition?: string;
        example?: string;
      }>;
    };

    const messages: ConversationMessage[] = [
      {
        id: "ai-welcome",
        sender: "ai",
        text: "Welcome",
        language: LanguageCode.English,
        createdAt: new Date().toISOString(),
      },
      {
        id: "user-1",
        sender: "user",
        text: "I very like this place",
        language: LanguageCode.English,
        createdAt: new Date().toISOString(),
      },
      {
        id: "ai-1",
        sender: "ai",
        text: "I really like this place. We often use really like in natural English.",
        language: LanguageCode.English,
        createdAt: new Date().toISOString(),
        meta: {
          score: 52,
          scoreReason: "Use really like instead of very like.",
          translation: "我真的很喜欢这个地方。我们常用 really like。",
          keyTerms: [
            {
              term: "really like",
              definition: "表示“很喜欢”，比 very like 更自然。",
              examples: ["I really like this place."],
            },
          ],
        },
      },
    ];

    const cards = service.extractLowScoreCards("conv-1", messages);

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      term: "really like",
      definition: "表示“很喜欢”，比 very like 更自然。",
      example: "I really like this place.",
    });
  });

  it("drops low-score cards when both learner input and tutor feedback are noisy", () => {
    const service = createService() as unknown as {
      extractLowScoreCards: (
        conversationId: string,
        messages: ConversationMessage[],
      ) => unknown[];
    };

    const messages: ConversationMessage[] = [
      {
        id: "ai-welcome",
        sender: "ai",
        text: "Welcome",
        language: LanguageCode.English,
        createdAt: new Date().toISOString(),
      },
      {
        id: "user-1",
        sender: "user",
        text: "test",
        language: LanguageCode.English,
        createdAt: new Date().toISOString(),
      },
      {
        id: "ai-1",
        sender: "ai",
        text: "our sentence is in English but it’s just a test phrase with no real content to practice",
        language: LanguageCode.English,
        createdAt: new Date().toISOString(),
        meta: {
          score: 40,
          scoreReason:
            "our sentence is in English but it’s just a test phrase with no real content to practice",
          translation: "这只是测试文本。",
          keyTerms: [],
        },
      },
    ];

    const cards = service.extractLowScoreCards("conv-1", messages);

    expect(cards).toEqual([]);
  });

  it("filters diagnostic-only score reasons that are not usable definitions", () => {
    const service = createService() as unknown as {
      extractLowScoreCards: (
        conversationId: string,
        messages: ConversationMessage[],
      ) => Array<{
        term: string;
        definition?: string;
      }>;
    };

    const messages: ConversationMessage[] = [
      {
        id: "ai-welcome",
        sender: "ai",
        text: "Welcome",
        language: LanguageCode.English,
        createdAt: new Date().toISOString(),
      },
      {
        id: "user-1",
        sender: "user",
        text: "go work now",
        language: LanguageCode.English,
        createdAt: new Date().toISOString(),
      },
      {
        id: "ai-1",
        sender: "ai",
        text: "I am going to work now.",
        language: LanguageCode.English,
        createdAt: new Date().toISOString(),
        meta: {
          score: 42,
          scoreReason:
            "Detected English with only one incomplete word, so meaning is unclear and needs a full question.",
          translation: "我现在要去上班。",
          keyTerms: [],
        },
      },
    ];

    const cards = service.extractLowScoreCards("conv-2", messages);

    expect(cards).toEqual([
      expect.objectContaining({
        term: "go work now",
        definition: "I am going to work now.",
      }),
    ]);
  });
});
