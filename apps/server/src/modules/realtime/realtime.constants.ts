export const REALTIME_SESSION_LIMITS = {
  guestSeconds: 120,
  authSeconds: 180,
} as const;

export const REALTIME_DEFAULT_VOICE = "Jennifer";

export const REALTIME_DEFAULT_TURN_DETECTION = {
  type: "server_vad",
  threshold: 0.74,
  prefix_padding_ms: 320,
  silence_duration_ms: 720,
} as const;

export const REALTIME_OFFER_COOLDOWN_MS = 1500;
export const REALTIME_WS_COOLDOWN_MS = 1500;
