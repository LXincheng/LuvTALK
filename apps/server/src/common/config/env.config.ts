import { ensureEnvLoaded } from "./load-env";

ensureEnvLoaded();

const readTrimmed = (...values: Array<string | undefined>): string => {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
};

const readNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
};

export const envConfig = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  runtime: {
    allowInMemoryFallback:
      readTrimmed(process.env.ALLOW_IN_MEMORY_FALLBACK).toLowerCase() ===
        "true" || process.env.NODE_ENV !== "production",
  },
  modelRouting: {
    primaryModel: readTrimmed(process.env.PRIMARY_MODEL),
    secondaryModel: readTrimmed(process.env.SECONDARY_MODEL),
    thirdModel: readTrimmed(process.env.THIRD_MODEL),
    immersiveReportModel: readTrimmed(
      process.env.IMMERSIVE_REPORT_MODEL,
      process.env.SECONDARY_MODEL,
    ),
    realtimeModel: readTrimmed(process.env.REALTIME_MODEL),
    realtimeTranscribeModel: readTrimmed(process.env.REALTIME_TRANSCRIBE_MODEL),
    sttModel: readTrimmed(process.env.STT_MODEL),
    ttsModel: readTrimmed(process.env.TTS_MODEL),
    translationModel: readTrimmed(process.env.TRANSLATION_MODEL),
  },
  modelTimeoutMs: {
    primary: readNumber(process.env.PRIMARY_MODEL_TIMEOUT_MS, 4500),
    secondary: readNumber(process.env.SECONDARY_MODEL_TIMEOUT_MS, 2200),
    third: readNumber(process.env.THIRD_MODEL_TIMEOUT_MS, 1500),
  },
  deepseek: {
    apiKey: readTrimmed(process.env.SECONDARY_API_KEY),
    apiUrl: readTrimmed(process.env.SECONDARY_API_URL),
  },
  openai: {
    apiKey: readTrimmed(process.env.PRIMARY_API_KEY),
    apiUrl: readTrimmed(process.env.PRIMARY_API_URL),
    realtimeApiKey: readTrimmed(
      process.env.PRIMARY_REALTIME_API_KEY,
      process.env.PRIMARY_API_KEY,
    ),
    realtimeApiUrl: readTrimmed(
      process.env.PRIMARY_REALTIME_API_URL,
      process.env.PRIMARY_API_URL
        ? `${process.env.PRIMARY_API_URL.replace(/\/$/, "")}/realtime`
        : "",
    ),
    audioApiUrl: readTrimmed(
      process.env.PRIMARY_AUDIO_API_URL,
      process.env.PRIMARY_API_URL
        ? `${process.env.PRIMARY_API_URL.replace(/\/$/, "")}/audio`
        : "",
    ),
  },
};

export type EnvConfig = typeof envConfig;
