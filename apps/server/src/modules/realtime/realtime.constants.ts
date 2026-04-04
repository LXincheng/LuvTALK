export const REALTIME_SESSION_LIMITS = {
  guestSeconds: 120,
  authSeconds: 180,
} as const;

export const REALTIME_DEFAULT_TURN_DETECTION = {
  type: "server_vad",
  threshold: 0.47,
  prefix_padding_ms: 280,
  silence_duration_ms: 650,
} as const;

export const REALTIME_OFFER_COOLDOWN_MS = 1500;
