import { LanguageCode } from "../enums/language-code.enum";
import { buildRealtimeSystemPrompt } from "./prompt.config";

describe("buildRealtimeSystemPrompt", () => {
  it("keeps Cantonese immersive replies anchored to Cantonese", () => {
    const prompt = buildRealtimeSystemPrompt({
      targetLanguage: LanguageCode.Cantonese,
      nativeLanguage: LanguageCode.Mandarin,
      scenarioLabel: "daily",
    });

    expect(prompt).toContain("Default to Cantonese / 广东话");
    expect(prompt).toContain("Use natural Hong Kong spoken Cantonese");
    expect(prompt).toContain(
      "Do not switch to Mandarin just because the transcript contains generic Han characters",
    );
  });
});
