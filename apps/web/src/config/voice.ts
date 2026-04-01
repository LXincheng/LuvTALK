import type { LocaleKey } from '../providers/LocaleContext';
import type { LanguageCode } from '../types/api';

export interface VoiceOption {
  id: string;
  labelKey?: LocaleKey;
  label?: string;
  descriptionKey?: LocaleKey;
  description?: string;
}

export interface VoiceCatalogItem {
  defaultVoice: string;
  options: string[];
}

const DEFAULT_VOICE_CATALOG: Record<LanguageCode, VoiceCatalogItem> = {
  mandarin: {
    defaultVoice: 'Serena',
    options: ['Serena', 'Ethan'],
  },
  cantonese: {
    defaultVoice: 'Kiki',
    options: ['Kiki', 'Rocky'],
  },
  english: {
    defaultVoice: 'Jennifer',
    options: ['Jennifer', 'Aiden'],
  },
};

const VOICE_LABELS: Record<string, { labelKey: LocaleKey; descriptionKey: LocaleKey }> = {
  Aiden: { labelKey: 'voiceAidenLabel', descriptionKey: 'voiceAidenDescription' },
  Ethan: { labelKey: 'voiceEthanLabel', descriptionKey: 'voiceEthanDescription' },
  Jennifer: { labelKey: 'voiceJenniferLabel', descriptionKey: 'voiceJenniferDescription' },
  Kiki: { labelKey: 'voiceKikiLabel', descriptionKey: 'voiceKikiDescription' },
  Rocky: { labelKey: 'voiceRockyLabel', descriptionKey: 'voiceRockyDescription' },
  Serena: { labelKey: 'voiceSerenaLabel', descriptionKey: 'voiceSerenaDescription' },
};

let activeVoiceCatalog: Record<LanguageCode, VoiceCatalogItem> = {
  mandarin: { ...DEFAULT_VOICE_CATALOG.mandarin, options: [...DEFAULT_VOICE_CATALOG.mandarin.options] },
  cantonese: { ...DEFAULT_VOICE_CATALOG.cantonese, options: [...DEFAULT_VOICE_CATALOG.cantonese.options] },
  english: { ...DEFAULT_VOICE_CATALOG.english, options: [...DEFAULT_VOICE_CATALOG.english.options] },
};

const dedupeVoices = (voices: readonly string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const voice of voices) {
    const trimmed = voice.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
};

export const setVoiceCatalog = (
  nextCatalog: Partial<Record<LanguageCode, VoiceCatalogItem>>,
) => {
  activeVoiceCatalog = {
    mandarin: normalizeCatalogItem('mandarin', nextCatalog.mandarin),
    cantonese: normalizeCatalogItem('cantonese', nextCatalog.cantonese),
    english: normalizeCatalogItem('english', nextCatalog.english),
  };
};

const normalizeCatalogItem = (
  language: LanguageCode,
  nextItem?: VoiceCatalogItem,
): VoiceCatalogItem => {
  const fallback = DEFAULT_VOICE_CATALOG[language];
  if (!nextItem) {
    return { defaultVoice: fallback.defaultVoice, options: [...fallback.options] };
  }
  const options = dedupeVoices(nextItem.options);
  const safeOptions = options.length ? options : [...fallback.options];
  const defaultVoice = safeOptions.includes(nextItem.defaultVoice)
    ? nextItem.defaultVoice
    : safeOptions[0] ?? fallback.defaultVoice;
  return { defaultVoice, options: safeOptions };
};

export const getTtsVoiceOptions = (
  language: LanguageCode,
): VoiceOption[] => activeVoiceCatalog[language].options.map((voiceId) => ({
  id: voiceId,
  ...(VOICE_LABELS[voiceId]
    ? {
        labelKey: VOICE_LABELS[voiceId].labelKey,
        descriptionKey: VOICE_LABELS[voiceId].descriptionKey,
      }
    : { label: voiceId }),
}));

export const getDefaultTtsVoice = (language: LanguageCode): string =>
  activeVoiceCatalog[language].defaultVoice;

export const isTtsVoiceSupported = (
  language: LanguageCode,
  voice: string | null | undefined,
): voice is string =>
  typeof voice === 'string' &&
  activeVoiceCatalog[language].options.includes(voice.trim());
