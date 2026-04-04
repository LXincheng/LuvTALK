import { LanguageCode } from "../../common/enums/language-code.enum";
import { ensureVoiceTipSet, toVoiceMicroTip } from "./voice-tip-templater";

describe("voice tip templater", () => {
  it("keeps only one sentence and adds actionable prefix when needed", () => {
    const tip = toVoiceMicroTip(
      "Vowels are unclear. This extra sentence should be dropped.",
      LanguageCode.English,
      { kind: "pronunciation" },
    );
    expect(tip).toContain("Try this: Vowels are unclear.");
    expect(tip).toContain("focus on one stressed word");
  });

  it("keeps actionable chinese tip without extra prefix", () => {
    const tip = toVoiceMicroTip(
      "先重读关键词，再放慢句尾速度。",
      LanguageCode.Mandarin,
      {
        kind: "rhythm",
      },
    );
    expect(tip).toContain("先重读关键词，再放慢句尾速度。");
    expect(tip).toContain("在意群边界做一次短停顿");
  });

  it("drops generic praise and keeps fallback tips focused on the learner utterance", () => {
    const output = ensureVoiceTipSet(
      {
        pronunciationTip: "Good job!",
      },
      {
        pronunciationTip: "Focus on stressed syllables.",
        rhythmTip: "Pause briefly between clauses.",
        grammarTip: "Use one tense consistently.",
      },
      LanguageCode.English,
      { scenarioId: "business" },
    );
    expect(output.pronunciationTip).toContain("Focus on stressed syllables.");
    expect(output.pronunciationTip).not.toContain("business chat");
  });

  it("fills missing tips from fallback set", () => {
    const output = ensureVoiceTipSet(
      {
        pronunciationTip: "",
      },
      {
        pronunciationTip: "Focus on stressed syllables.",
        rhythmTip: "Pause briefly between clauses.",
        grammarTip: "Use one tense consistently.",
      },
      LanguageCode.English,
      { scenarioId: "daily" },
    );
    expect(output.pronunciationTip).toContain("Focus on stressed syllables.");
    expect(output.rhythmTip).toContain("Pause briefly between clauses.");
    expect(output.grammarTip).toContain("Use one tense consistently.");
  });
});
