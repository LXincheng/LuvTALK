import { LanguageCode } from "../../common/enums/language-code.enum";
import {
  buildProsodyReadyTtsInput,
  extractPrimarySpokenSegment,
} from "./tts-prosody";

describe("tts prosody helpers", () => {
  it("extracts primary spoken segment before study steps", () => {
    const source =
      "You can say this sentence naturally.\n\nStudy Steps:\n1. do this\n2. do that";
    expect(extractPrimarySpokenSegment(source)).toBe(
      "You can say this sentence naturally.",
    );
  });

  it("keeps punctuation spacing and adds question pause for English", () => {
    const source = "Could you help me with this?Please show me the route.";
    const output = buildProsodyReadyTtsInput(source, LanguageCode.English);
    expect(output).toContain("? ... ");
    expect(output).toContain("route.");
  });

  it("removes list markers and lead-in fillers for cleaner speech", () => {
    const source = "Sure! 1. Start here 2. then go there";
    const output = buildProsodyReadyTtsInput(source, LanguageCode.English);
    expect(output).not.toContain("1.");
    expect(output).not.toContain("Sure!");
  });

  it("uses scenario-aware pause for business style", () => {
    const source =
      "We can align on the timeline today and confirm the owner for each action item before launch";
    const output = buildProsodyReadyTtsInput(
      source,
      LanguageCode.English,
      "business",
    );
    expect(output).toContain("; ");
  });

  it("clips overlong input to safe tts length", () => {
    const source = "word ".repeat(120);
    const output = buildProsodyReadyTtsInput(
      source,
      LanguageCode.English,
      "business",
    );
    expect(output.length).toBeLessThanOrEqual(283);
  });
});
