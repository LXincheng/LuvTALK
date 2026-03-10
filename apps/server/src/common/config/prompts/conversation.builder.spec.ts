import { LanguageCode } from "../../enums/language-code.enum";
import { buildLayeredConversationPrompt } from "./conversation.builder";

describe("buildLayeredConversationPrompt", () => {
  it("includes base, mode, level and safety sections", () => {
    const prompt = buildLayeredConversationPrompt({
      targetLanguage: LanguageCode.English,
      nativeLanguage: LanguageCode.Mandarin,
      scenarioLabel: "Daily small talk",
      interactionMode: "voice",
      learnerLevel: "beginner",
    });

    expect(prompt).toContain("You are LuvTALK's bilingual language tutor");
    expect(prompt).toContain("MODE RULES (voice):");
    expect(prompt).toContain("LEVEL RULES (beginner):");
    expect(prompt).toContain("SAFETY & STRUCTURE RULES:");
  });

  it("uses defaults for mode and level", () => {
    const prompt = buildLayeredConversationPrompt({
      targetLanguage: LanguageCode.Cantonese,
      nativeLanguage: LanguageCode.English,
      scenarioLabel: "Shopping chat",
    });

    expect(prompt).toContain("Current interaction mode: text.");
    expect(prompt).toContain("LEVEL RULES (intermediate):");
  });
});
