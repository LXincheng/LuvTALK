import { LanguageCode } from "../enums/language-code.enum";

export interface VoiceCatalogItem {
  languageCode: string;
  ttsLanguageType: string;
  defaultVoice: string;
  options: string[];
}

export const OFFICIAL_TTS_VOICE_CATALOG: Record<
  LanguageCode,
  VoiceCatalogItem
> = {
  [LanguageCode.Mandarin]: {
    languageCode: "zh",
    ttsLanguageType: "Chinese",
    defaultVoice: "Serena",
    options: ["Serena", "Ethan"],
  },
  [LanguageCode.Cantonese]: {
    languageCode: "yue",
    ttsLanguageType: "Chinese",
    defaultVoice: "Kiki",
    options: ["Kiki", "Rocky"],
  },
  [LanguageCode.English]: {
    languageCode: "en",
    ttsLanguageType: "English",
    defaultVoice: "Aiden",
    options: ["Aiden", "Jennifer"],
  },
};

export const FLASH_ONLY_TTS_VOICES = new Set([
  "Kiki",
  "Rocky",
  "Jennifer",
  "Aiden",
]);

export const OFFICIAL_TTS_VOICES = new Set(
  Object.values(OFFICIAL_TTS_VOICE_CATALOG).flatMap((item) => item.options),
);

export const resolveLanguageVoiceSettings = (
  language: LanguageCode | string | undefined,
): VoiceCatalogItem => {
  if (language === LanguageCode.Cantonese) {
    return OFFICIAL_TTS_VOICE_CATALOG[LanguageCode.Cantonese];
  }
  if (language === LanguageCode.Mandarin) {
    return OFFICIAL_TTS_VOICE_CATALOG[LanguageCode.Mandarin];
  }
  return OFFICIAL_TTS_VOICE_CATALOG[LanguageCode.English];
};

export const resolvePreferredVoiceForLanguage = (
  language: LanguageCode | string | undefined,
  requestedVoice?: string,
  options?: {
    allowCrossLanguage?: boolean;
  },
): string => {
  const settings = resolveLanguageVoiceSettings(language);
  const normalized = requestedVoice?.trim();
  if (
    normalized &&
    (settings.options.includes(normalized) ||
      (options?.allowCrossLanguage && OFFICIAL_TTS_VOICES.has(normalized)))
  ) {
    return normalized;
  }
  return settings.defaultVoice;
};
