import { ensureEnvLoaded } from "./load-env";

ensureEnvLoaded();

export const envConfig = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  deepseek: {
    apiKey: (
      process.env.DS_AI_API_KEY ??
      process.env.DEEPSEEK_API_KEY ??
      ""
    ).trim(),
    apiUrl:
      process.env.DS_AI_API_URL ??
      process.env.DEEPSEEK_API_URL ??
      "https://api.deepseek.com/v1",
    model: process.env.DS_AI_MODEL ?? "deepseek-chat",
  },
};

export type EnvConfig = typeof envConfig;
