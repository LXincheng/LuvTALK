export const REALTIME_SESSION_LIMITS = {
  guestSeconds: 120,
  authSeconds: 180,
} as const;

export const REALTIME_DEFAULT_TURN_DETECTION = {
  type: "server_vad",
  threshold: 0.5,
  silence_duration_ms: 900,
} as const;

export const REALTIME_INPUT_AUDIO_TRANSCRIPTION = {
  model: "qwen3-asr-flash-realtime",
} as const;

export const REALTIME_OFFER_COOLDOWN_MS = 1500;
