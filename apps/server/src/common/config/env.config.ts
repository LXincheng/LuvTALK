import { ensureEnvLoaded } from "./load-env";

ensureEnvLoaded();

export const envConfig = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  deepseek: {
    apiKey: (process.env.DS_AI_API_KEY ?? "").trim(),
    apiUrl: process.env.DS_AI_API_URL ?? "https://api.deepseek.com/v1",
    model: process.env.DS_AI_MODEL ?? "deepseek-chat",
  },
  openai: {
    apiKey: (process.env.OPENAI_API_KEY ?? "").trim(),
    apiUrl: process.env.OPENAI_API_URL ?? "https://api.openai.com/v1",
    realtimeApiUrl:
      process.env.OPENAI_REALTIME_API_URL ?? "ws://yunwu.ai/v1/realtime",
    audioApiUrl:
      process.env.OPENAI_AUDIO_API_URL ??
      `${process.env.OPENAI_API_URL ?? "https://api.openai.com/v1"}/audio`,
    transcribeModel:
      process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe",
    tutorModel: process.env.OPENAI_TUTOR_MODEL ?? "gpt-5.1",
    ttsModel: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
    realtimeModel:
      process.env.OPENAI_REALTIME_MODEL ?? "gpt-4o-realtime-preview",
  },
};

export type EnvConfig = typeof envConfig;
