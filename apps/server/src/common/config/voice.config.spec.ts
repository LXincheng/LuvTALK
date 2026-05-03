import { LanguageCode } from "../enums/language-code.enum";
import {
  resolvePreferredRealtimeVoiceForLanguage,
  resolveRealtimeVoiceSettings,
} from "./voice.config";

describe("realtime voice config", () => {
  it("uses Rocky as the Cantonese realtime default", () => {
    const settings = resolveRealtimeVoiceSettings(LanguageCode.Cantonese);

    expect(settings.defaultVoice).toBe("Rocky");
    expect(settings.options).toEqual(["Rocky", "Wil"]);
  });

  it("does not pass unsupported legacy Cantonese TTS voices to realtime", () => {
    expect(
      resolvePreferredRealtimeVoiceForLanguage(
        LanguageCode.Cantonese,
        "Kiki",
        { allowCrossLanguage: true },
      ),
    ).toBe("Rocky");
  });

  it("keeps supported Cantonese realtime voices", () => {
    expect(
      resolvePreferredRealtimeVoiceForLanguage(LanguageCode.Cantonese, "Wil"),
    ).toBe("Wil");
  });
});
