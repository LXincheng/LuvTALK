import { LanguageCode } from "../../common/enums/language-code.enum";
import { normalizeAiResponsePayload } from "./ai-response-normalizer";

describe("normalizeAiResponsePayload", () => {
  it("fills missing fields and coerces score type", () => {
    const result = normalizeAiResponsePayload(
      {
        reply: "Great effort. Let's refine it.",
        score: "87",
        associativePhrases: ["Please try once more."],
      },
      {
        fallbackReason: "Auto-evaluated by test fallback",
        targetLanguage: LanguageCode.English,
      },
    );

    expect(result).not.toBeNull();
    expect(result?.score).toBe(87);
    expect(result?.scoreReason).toBe("Auto-evaluated by test fallback");
    expect(result?.associativePhrases.length).toBeGreaterThanOrEqual(2);
  });

  it("supports key_terms alias and sanitizes optional tips", () => {
    const result = normalizeAiResponsePayload(
      {
        reply: "继续说下去。",
        score: 75,
        scoreReason: "语气自然，继续保持。",
        pronunciationTip: "重音可以再清晰一点。第二句不需要输出。",
        key_terms: [
          {
            term: "继续",
            definition: "keep going",
            examples: ["继续练习。", "继续加油。", "第三句会被截断。"],
          },
          {
            definition: "missing term should be ignored",
          },
        ],
      },
      {
        fallbackReason: "fallback",
        targetLanguage: LanguageCode.Mandarin,
      },
    );

    expect(result).not.toBeNull();
    expect(result?.keyTerms.length).toBe(1);
    expect(result?.keyTerms[0]?.term).toBe("继续");
    expect(result?.keyTerms[0]?.examples.length).toBe(2);
    expect(result?.pronunciationTip).toBe(
      "重音可以再清晰一点。第二句不需要输出。",
    );
  });

  it("returns null when reply is missing", () => {
    const result = normalizeAiResponsePayload(
      {
        score: 80,
        scoreReason: "reason",
      },
      {
        fallbackReason: "fallback",
        targetLanguage: LanguageCode.English,
      },
    );

    expect(result).toBeNull();
  });

  it("clamps out-of-range score to valid bounds", () => {
    const high = normalizeAiResponsePayload(
      {
        reply: "ok",
        score: 199,
        scoreReason: "too high",
      },
      {
        fallbackReason: "fallback",
        targetLanguage: LanguageCode.English,
      },
    );
    const low = normalizeAiResponsePayload(
      {
        reply: "ok",
        score: -10,
        scoreReason: "too low",
      },
      {
        fallbackReason: "fallback",
        targetLanguage: LanguageCode.English,
      },
    );

    expect(high?.score).toBe(100);
    expect(low?.score).toBe(0);
  });
});
