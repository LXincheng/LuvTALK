import { buildLayeredConversationPrompt } from "./conversation.builder";
import {
  DEFAULT_PROMPT_PROFILE,
  buildConversationSystemPromptWithProfile,
  resolvePromptProfileId,
} from "./prompt.profile";
import { LanguageCode } from "../../enums/language-code.enum";

describe("prompt profiles", () => {
  it("defaults to stable profile when env is missing/unknown", () => {
    expect(resolvePromptProfileId(undefined)).toBe(DEFAULT_PROMPT_PROFILE);
    expect(resolvePromptProfileId("")).toBe(DEFAULT_PROMPT_PROFILE);
    expect(resolvePromptProfileId("unknown_profile")).toBe(
      DEFAULT_PROMPT_PROFILE,
    );
  });

  it("resolves experimental aliases", () => {
    expect(resolvePromptProfileId("exp_teaching_v1")).toBe("exp_teaching_v1");
    expect(resolvePromptProfileId("exp-teaching-v1")).toBe("exp_teaching_v1");
  });

  it("keeps stable profile identical to layered builder output", () => {
    const input = {
      targetLanguage: LanguageCode.English,
      nativeLanguage: LanguageCode.Mandarin,
      scenarioLabel: "Daily chat",
      interactionMode: "text" as const,
    };
    const stable = buildConversationSystemPromptWithProfile(input, "stable");
    const layered = buildLayeredConversationPrompt(input);
    expect(stable).toBe(layered);
  });

  it("adds a small quality guard in experimental profile", () => {
    const input = {
      targetLanguage: LanguageCode.English,
      nativeLanguage: LanguageCode.Mandarin,
      scenarioLabel: "Restaurant chat",
      interactionMode: "text" as const,
    };
    const exp = buildConversationSystemPromptWithProfile(
      input,
      "exp_teaching_v1",
    );
    expect(exp).toContain("QUALITY GUARD (exp_teaching_v1):");
  });
});
