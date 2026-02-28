export const REALTIME_SERVER_ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  RATE_LIMITED: "RATE_LIMITED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type RealtimeServerErrorCode =
  (typeof REALTIME_SERVER_ERROR_CODES)[keyof typeof REALTIME_SERVER_ERROR_CODES];

export interface RealtimeServerErrorPayload {
  type: "server.error";
  code: RealtimeServerErrorCode;
  message: string;
  retriable: boolean;
  detail?: string;
}
