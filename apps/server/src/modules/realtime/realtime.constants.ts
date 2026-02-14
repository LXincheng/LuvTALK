export const REALTIME_SESSION_LIMITS = {
  guestSeconds: 120,
  authSeconds: 180,
} as const;

export const REALTIME_DEFAULT_VOICE = "shimmer";

export const REALTIME_DEFAULT_TURN_DETECTION = {
  type: "server_vad",
  threshold: 0.6,
  prefix_padding_ms: 400,
  silence_duration_ms: 1500,
} as const;

export const REALTIME_OFFER_COOLDOWN_MS = 1500;
export const REALTIME_WS_COOLDOWN_MS = 1500;
