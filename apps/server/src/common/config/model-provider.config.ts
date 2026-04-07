import { envConfig } from "./env.config";

export type ModelProvider = "primary" | "secondary";

export interface ChatModelRoute {
  provider: ModelProvider;
  apiKey: string;
  endpoint: string;
  model: string;
}

export interface ThinkingTogglePayload {
  enable_thinking?: boolean;
}

const QWEN_MODEL_PREFIX = /^(qwen|qwq)/i;
const DEEPSEEK_MODEL_PREFIX = /^deepseek/i;

const normalizeBaseUrl = (value?: string): string =>
  value?.replace(/\/$/, "") ?? "";

export const isQwenModel = (model?: string): boolean =>
  Boolean(model?.trim() && QWEN_MODEL_PREFIX.test(model.trim()));

export const isDeepSeekModel = (model?: string): boolean =>
  Boolean(model?.trim() && DEEPSEEK_MODEL_PREFIX.test(model.trim()));

export const supportsThinkingToggle = (model?: string): boolean =>
  Boolean(
    model?.trim() &&
      /^qwen(3|3\.5|plus|max|turbo)/i.test(model.trim()) &&
      !/^qwen-(mt|tts|audio)/i.test(model.trim()),
  );

export const supportsJsonObjectResponse = (model?: string): boolean =>
  isQwenModel(model) && !/^qwen-(tts|audio)/i.test(model!.trim());

export const applyThinkingToggle = <T extends ThinkingTogglePayload>(
  payload: T,
  model: string | undefined,
  enabled: boolean,
): T => {
  if (!supportsThinkingToggle(model)) {
    return payload;
  }
  payload.enable_thinking = enabled;
  return payload;
};

export const resolveChatCompletionEndpoint = (baseUrl?: string): string => {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) {
    return "";
  }
  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }
  return `${normalized}/chat/completions`;
};

export const resolveDashscopeGenerationEndpoint = (
  baseUrl?: string,
): string => {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) {
    return "";
  }
  const root = normalized
    .replace(/\/compatible-mode\/v1$/i, "")
    .replace(/\/v1$/i, "")
    .replace(/\/api\/v1$/i, "");
  return `${root}/api/v1/services/aigc/multimodal-generation/generation`;
};

export const resolveChatModelRoute = (
  model?: string,
): ChatModelRoute | null => {
  const normalizedModel = model?.trim();
  if (!normalizedModel) {
    return null;
  }

  if (isDeepSeekModel(normalizedModel)) {
    const endpoint = resolveChatCompletionEndpoint(envConfig.deepseek.apiUrl);
    if (!envConfig.deepseek.apiKey || !endpoint) {
      return null;
    }
    return {
      provider: "secondary",
      apiKey: envConfig.deepseek.apiKey,
      endpoint,
      model: normalizedModel,
    };
  }

  const endpoint = resolveChatCompletionEndpoint(envConfig.openai.apiUrl);
  if (!envConfig.openai.apiKey || !endpoint) {
    return null;
  }
  return {
    provider: "primary",
    apiKey: envConfig.openai.apiKey,
    endpoint,
    model: normalizedModel,
  };
};
