export const CONVERSATION_DEFAULTS = {
  scenarioId: "daily",
  historyWindow: 6,
  openAiTemperature: 0.65,
  fallbackTemperature: 0.6,
  fallbackScore: 62,
} as const;

export const CONVERSATION_ENDPOINTS = {
  apiVersionPath: "/v1",
  chatCompletionsPath: "/chat/completions",
} as const;

export const CONVERSATION_LOG_COPY = {
  missingPrimaryConfig:
    "Primary tutor model config missing; skip primary route.",
  missingSecondaryConfig:
    "Secondary/third model config missing; skip fallback route.",
  primaryEmptyResponse: "Primary tutor returned empty content.",
  primaryFallbackReason: "Auto-evaluated by primary model",
  fallbackReason: "Auto-evaluated by fallback model",
  fallbackPayloadMissingJson: "AI response missing JSON payload.",
  fallbackPayloadNormalizeFailed: "AI response normalization failed.",
} as const;
