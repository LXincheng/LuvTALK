import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { IncomingMessage, Server as HttpServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import type { RawData } from "ws";
import { envConfig } from "../../common/config/env.config";
import { buildRealtimeSystemPrompt } from "../../common/config/prompt.config";
import { LanguageCode } from "../../common/enums/language-code.enum";
import { AuthService, AuthUserProfile } from "../auth/auth.service";
import { ConversationService } from "../conversation/conversation.service";
import {
  REALTIME_DEFAULT_TURN_DETECTION,
  REALTIME_DEFAULT_VOICE,
  REALTIME_SESSION_LIMITS,
  REALTIME_WS_COOLDOWN_MS,
} from "./realtime.constants";
import {
  REALTIME_SERVER_ERROR_CODES,
  RealtimeServerErrorCode,
  RealtimeServerErrorPayload,
} from "./realtime-error.types";
import { RealtimeMetricsService } from "./realtime-metrics.service";
import {
  buildSessionUpdate,
  mapCloseCodeToErrorCode,
  resolveSafeCloseCode,
} from "./realtime.ws.helpers";

type ClientEvent =
  | "input_audio_buffer.append"
  | "input_audio_buffer.commit"
  | "input_audio_buffer.clear"
  | "response.create"
  | "response.cancel"
  | "conversation.item.create"
  | "session.update";

const CLIENT_EVENT_ALLOWLIST = new Set<ClientEvent>([
  "input_audio_buffer.append",
  "input_audio_buffer.commit",
  "input_audio_buffer.clear",
  "response.create",
  "response.cancel",
  "conversation.item.create",
  "session.update",
]);

const MAX_AUDIO_BASE64_LENGTH = 512 * 1024;
const RECONNECT_WINDOW_MS = 20_000;

@Injectable()
export class RealtimeWsProxy {
  private readonly logger = new Logger(RealtimeWsProxy.name);
  private readonly cooldown = new Map<string, number>();
  private server?: WebSocketServer;

  constructor(
    private readonly conversationService: ConversationService,
    private readonly authService: AuthService,
    private readonly realtimeMetrics: RealtimeMetricsService,
  ) {}

  attach(server: HttpServer) {
    if (this.server) {
      return;
    }
    this.server = new WebSocketServer({
      server,
      path: "/api/realtime/ws",
    });
    this.server.on("connection", (socket, req) => {
      void this.handleConnection(socket, req);
    });
    this.logger.log("Realtime WS proxy attached on /api/realtime/ws");
  }

  private async handleConnection(
    client: WebSocket,
    req: IncomingMessage,
  ): Promise<void> {
    const wsAcceptedAt = Date.now();
    this.realtimeMetrics.recordConnectionAccepted();

    try {
      const url = new URL(req.url ?? "", "http://localhost");
      const conversationId = url.searchParams.get("conversationId") ?? "";
      if (!conversationId) {
        this.closeWithMetric({
          client,
          wsCode: 1008,
          code: REALTIME_SERVER_ERROR_CODES.BAD_REQUEST,
          message: "conversationId required",
          retriable: false,
        });
        return;
      }

      const accessToken = url.searchParams.get("accessToken") ?? undefined;
      const conversationKey =
        url.searchParams.get("conversationKey") ?? undefined;
      const requestedVoice = url.searchParams.get("voice") ?? undefined;
      const scenarioId = url.searchParams.get("scenarioId") ?? undefined;

      const profile = await this.resolveProfile(accessToken);

      const session = await this.conversationService.getAccessibleSession(
        conversationId,
        {
          userId: profile?.id,
          conversationKey,
          bindUserIfAuthenticated: true,
          allowBootstrapMissingAccessKey: true,
        },
      );

      const cooldownKey = profile
        ? `user:${profile.id}`
        : `guest:${conversationId}`;
      const now = Date.now();
      const last = this.cooldown.get(cooldownKey);
      if (last && now - last < REALTIME_WS_COOLDOWN_MS) {
        this.closeWithMetric({
          client,
          wsCode: 1013,
          code: REALTIME_SERVER_ERROR_CODES.RATE_LIMITED,
          message: "Too many connections",
          retriable: true,
        });
        return;
      }
      if (last && now - last <= RECONNECT_WINDOW_MS) {
        this.realtimeMetrics.recordReconnectAttempt();
      }
      this.cooldown.set(cooldownKey, now);

      const { apiKey, realtimeApiUrl } = envConfig.openai;
      const realtimeModel = envConfig.modelRouting.realtimeModel;
      const transcribeModel = envConfig.modelRouting.sttModel;
      if (!apiKey || !realtimeApiUrl || !realtimeModel) {
        this.closeWithMetric({
          client,
          wsCode: 1011,
          code: REALTIME_SERVER_ERROR_CODES.SERVICE_UNAVAILABLE,
          message: "Realtime service unavailable",
          retriable: true,
        });
        return;
      }

      const scenarioLabel = scenarioId ?? session.scenarioId ?? "daily";
      const prompt = buildRealtimeSystemPrompt({
        targetLanguage: session.targetLanguage,
        nativeLanguage: session.nativeLanguage ?? LanguageCode.Mandarin,
        scenarioLabel,
      });

      const upstreamUrl = resolveRealtimeWsUrl(realtimeApiUrl, realtimeModel);
      this.logger.log(`Realtime upstream connecting -> ${upstreamUrl}`);
      const upstream = new WebSocket(upstreamUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "OpenAI-Beta": "realtime=v1",
        },
      });
      let upstreamTerminalHandled = false;

      let currentVoice =
        (requestedVoice?.trim() || REALTIME_DEFAULT_VOICE) ??
        REALTIME_DEFAULT_VOICE;

      const maxSessionSeconds = profile
        ? REALTIME_SESSION_LIMITS.authSeconds
        : REALTIME_SESSION_LIMITS.guestSeconds;

      upstream.on("open", () => {
        this.realtimeMetrics.recordConnectionEstablished(
          Date.now() - wsAcceptedAt,
        );
        this.logger.log("Realtime upstream connected");
        const update = buildSessionUpdate({
          instructions: prompt,
          voice: currentVoice,
          turnDetection: REALTIME_DEFAULT_TURN_DETECTION,
          transcribeModel,
        });
        upstream.send(JSON.stringify(update));
        client.send(
          JSON.stringify({
            type: "server.info",
            maxSessionSeconds,
          }),
        );
      });

      upstream.on("message", (data) => {
        if (client.readyState !== WebSocket.OPEN) {
          return;
        }
        // Convert to string so it's sent as a text frame (not binary).
        // Browser WebSocket only processes text frames as strings.
        const text = toTextMessage(data);
        if (!text) {
          return;
        }
        // Log important upstream events for debugging
        const parsed = safeParseJson(text);
        if (parsed && typeof parsed.type === "string") {
          const eventType = parsed.type;
          if (
            eventType === "error" ||
            eventType === "session.created" ||
            eventType === "session.updated"
          ) {
            this.logger.log(
              `Realtime upstream event: ${eventType} ${eventType === "error" ? JSON.stringify(parsed.error ?? parsed) : ""}`,
            );
          }
        }
        client.send(text);
      });

      upstream.on("unexpected-response", (_request, response) => {
        void safeReadResponseBody(response)
          .then((body) => {
            const detail = [
              `status=${response.statusCode ?? "unknown"}`,
              body ? `body=${body.slice(0, 220)}` : "",
            ]
              .filter(Boolean)
              .join(" | ");
            this.logger.warn(
              `Realtime upstream unexpected response: ${detail || "unknown"}`,
            );
            if (upstreamTerminalHandled) {
              return;
            }
            upstreamTerminalHandled = true;
            this.closeWithMetric({
              client,
              wsCode: 1011,
              code: REALTIME_SERVER_ERROR_CODES.SERVICE_UNAVAILABLE,
              message: "Realtime upstream rejected connection",
              retriable: false,
              detail,
            });
          })
          .catch(() => {
            if (upstreamTerminalHandled) {
              return;
            }
            upstreamTerminalHandled = true;
            this.closeWithMetric({
              client,
              wsCode: 1011,
              code: REALTIME_SERVER_ERROR_CODES.SERVICE_UNAVAILABLE,
              message: "Realtime upstream rejected connection",
              retriable: false,
            });
          });
      });

      upstream.on("close", (code, reason) => {
        if (upstreamTerminalHandled) {
          return;
        }
        upstreamTerminalHandled = true;
        this.realtimeMetrics.recordWsClosed(code);
        this.logger.warn(
          `Realtime upstream closed (${code}): ${reason.toString()}`,
        );
        if (code !== 1000) {
          const mapped = mapCloseCodeToErrorCode(code);
          this.realtimeMetrics.recordConnectionFailure({
            errorCode: mapped.code,
            wsCode: code,
            retriable: mapped.retriable,
            message: reason.toString() || mapped.message,
          });
        }
        if (client.readyState === WebSocket.OPEN) {
          const mapped = mapCloseCodeToErrorCode(code);
          if (code !== 1000) {
            sendServerError(client, {
              code: mapped.code,
              message: mapped.message,
              retriable: mapped.retriable,
              detail: reason.toString(),
            });
          }
          client.close(resolveSafeCloseCode(code), reason.toString());
        }
      });

      upstream.on("error", (error) => {
        if (upstreamTerminalHandled) {
          return;
        }
        upstreamTerminalHandled = true;
        this.logger.warn(`Realtime upstream error: ${error.message}`);
        this.closeWithMetric({
          client,
          upstream,
          wsCode: 1011,
          code: REALTIME_SERVER_ERROR_CODES.UPSTREAM_ERROR,
          message: "Realtime upstream error",
          retriable: true,
          detail: error.message,
        });
      });

      client.on("message", (data) => {
        if (upstream.readyState !== WebSocket.OPEN) {
          return;
        }
        const text = toTextMessage(data);
        if (!text) {
          return;
        }
        const payload = safeParseJson(text);
        if (!payload || typeof payload.type !== "string") {
          return;
        }
        const type = payload.type as ClientEvent;
        if (!CLIENT_EVENT_ALLOWLIST.has(type)) {
          return;
        }
        if (type === "session.update") {
          const voice = resolveVoice(payload.session);
          if (voice) {
            currentVoice = voice;
          }
          const update = buildSessionUpdate({
            instructions: prompt,
            voice: currentVoice,
            turnDetection: REALTIME_DEFAULT_TURN_DETECTION,
            transcribeModel,
          });
          upstream.send(JSON.stringify(update));
          return;
        }
        if (type === "input_audio_buffer.append") {
          const audio = resolveAudioPayload(payload.audio);
          if (!audio || audio.length > MAX_AUDIO_BASE64_LENGTH) {
            return;
          }
          upstream.send(
            JSON.stringify({
              type,
              audio,
            }),
          );
          return;
        }
        upstream.send(JSON.stringify(payload));
      });

      client.on("close", (code) => {
        this.realtimeMetrics.recordWsClosed(code);
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.close(1000, "Client disconnected");
        }
      });

      client.on("error", (error) => {
        this.logger.warn(`Realtime client error: ${error.message}`);
        this.closeWithMetric({
          client,
          upstream,
          wsCode: 1011,
          code: REALTIME_SERVER_ERROR_CODES.INTERNAL_ERROR,
          message: "Realtime client error",
          retriable: true,
          detail: error.message,
        });
      });
    } catch (error) {
      const detail = (error as Error).message;
      this.logger.warn(`Realtime WS connection failed: ${detail}`);
      const isNotFound = error instanceof NotFoundException;
      this.closeWithMetric({
        client,
        wsCode: isNotFound ? 1008 : 1011,
        code: isNotFound
          ? REALTIME_SERVER_ERROR_CODES.PERMISSION_DENIED
          : REALTIME_SERVER_ERROR_CODES.INTERNAL_ERROR,
        message: isNotFound
          ? "Conversation not found"
          : "Realtime connection failed",
        retriable: !isNotFound,
        detail,
      });
    }
  }

  private closeWithMetric(params: {
    client: WebSocket;
    upstream?: WebSocket;
    wsCode: number;
    code: RealtimeServerErrorCode;
    message: string;
    retriable: boolean;
    detail?: string;
  }) {
    this.realtimeMetrics.recordConnectionFailure({
      errorCode: params.code,
      wsCode: params.wsCode,
      retriable: params.retriable,
      message: params.detail || params.message,
    });
    closeWithServerError(params);
  }

  private async resolveProfile(
    accessToken?: string,
  ): Promise<AuthUserProfile | undefined> {
    if (!accessToken) {
      return undefined;
    }
    const supabaseProfile =
      await this.authService.verifySupabaseAccessToken(accessToken);
    if (supabaseProfile) {
      return supabaseProfile;
    }
    return this.authService.verifyAccessToken(accessToken);
  }
}

const resolveRealtimeWsUrl = (base: string, model: string): string => {
  const normalized = base.replace(/\/$/, "");
  const httpUrl = normalized.endsWith("/realtime")
    ? normalized
    : `${normalized}/realtime`;
  // Map http(s) to ws(s), or keep ws(s) as-is
  let wsUrl: string;
  if (httpUrl.startsWith("wss://") || httpUrl.startsWith("ws://")) {
    wsUrl = httpUrl;
  } else if (httpUrl.startsWith("https://")) {
    wsUrl = `wss://${httpUrl.slice("https://".length)}`;
  } else if (httpUrl.startsWith("http://")) {
    wsUrl = `ws://${httpUrl.slice("http://".length)}`;
  } else {
    wsUrl = httpUrl;
  }
  const joiner = wsUrl.includes("?") ? "&" : "?";
  return `${wsUrl}${joiner}model=${encodeURIComponent(model)}`;
};

const resolveVoice = (session?: unknown): string | undefined => {
  if (!session || typeof session !== "object") {
    return undefined;
  }
  const voice = (session as { voice?: unknown }).voice;
  return typeof voice === "string" && voice.trim() ? voice.trim() : undefined;
};

const resolveAudioPayload = (audio?: unknown): string | undefined => {
  return typeof audio === "string" && audio.trim() ? audio.trim() : undefined;
};

const sendServerError = (
  client: WebSocket,
  payload: Omit<RealtimeServerErrorPayload, "type">,
) => {
  if (client.readyState !== WebSocket.OPEN) {
    return;
  }
  client.send(
    JSON.stringify({
      type: "server.error",
      ...payload,
    }),
  );
};

const closeWithServerError = (params: {
  client: WebSocket;
  upstream?: WebSocket;
  wsCode: number;
  code: RealtimeServerErrorCode;
  message: string;
  retriable: boolean;
  detail?: string;
}) => {
  sendServerError(params.client, {
    code: params.code,
    message: params.message,
    retriable: params.retriable,
    detail: params.detail,
  });
  if (params.client.readyState === WebSocket.OPEN) {
    params.client.close(params.wsCode, params.message);
  }
  if (params.upstream && params.upstream.readyState === WebSocket.OPEN) {
    params.upstream.close(params.wsCode, params.message);
  }
};

const safeParseJson = (value: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const toTextMessage = (data: RawData): string | null => {
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof Buffer) {
    return data.toString("utf8");
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }
  return null;
};

const safeReadResponseBody = async (
  response: IncomingMessage,
): Promise<string> => {
  const chunks: Buffer<ArrayBufferLike>[] = [];
  return new Promise((resolve) => {
    response.on("data", (chunk: RawData) => {
      if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk, "utf8"));
        return;
      }
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
        return;
      }
      if (chunk instanceof ArrayBuffer) {
        chunks.push(Buffer.from(chunk));
        return;
      }
      chunks.push(Buffer.concat(chunk.map((part) => Buffer.from(part))));
    });
    response.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    response.on("error", () => {
      resolve("");
    });
  });
};
