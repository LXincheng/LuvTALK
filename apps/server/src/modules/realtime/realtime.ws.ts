import { Injectable, Logger } from "@nestjs/common";
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

@Injectable()
export class RealtimeWsProxy {
  private readonly logger = new Logger(RealtimeWsProxy.name);
  private readonly cooldown = new Map<string, number>();
  private server?: WebSocketServer;

  constructor(
    private readonly conversationService: ConversationService,
    private readonly authService: AuthService,
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
    try {
      const url = new URL(req.url ?? "", "http://localhost");
      const conversationId = url.searchParams.get("conversationId") ?? "";
      if (!conversationId) {
        client.close(1008, "conversationId required");
        return;
      }

      const accessToken = url.searchParams.get("accessToken") ?? undefined;
      const requestedVoice = url.searchParams.get("voice") ?? undefined;
      const scenarioId = url.searchParams.get("scenarioId") ?? undefined;

      const profile = await this.resolveProfile(accessToken);

      const session = await this.conversationService.getSession(conversationId);
      if (session.userId && (!profile || session.userId !== profile.id)) {
        client.close(1008, "Conversation not found");
        return;
      }
      if (!session.userId && profile) {
        session.userId = profile.id;
        await this.conversationService.persistSessionPublic(session);
      }

      const cooldownKey = profile
        ? `user:${profile.id}`
        : `guest:${conversationId}`;
      const now = Date.now();
      const last = this.cooldown.get(cooldownKey);
      if (last && now - last < REALTIME_WS_COOLDOWN_MS) {
        client.close(1013, "Too many connections");
        return;
      }
      this.cooldown.set(cooldownKey, now);

      const { apiKey, realtimeApiUrl, realtimeModel, transcribeModel } =
        envConfig.openai;
      if (!apiKey || !realtimeApiUrl || !realtimeModel) {
        client.close(1011, "Realtime service unavailable");
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

      let currentVoice =
        (requestedVoice?.trim() || REALTIME_DEFAULT_VOICE) ??
        REALTIME_DEFAULT_VOICE;

      const maxSessionSeconds = profile
        ? REALTIME_SESSION_LIMITS.authSeconds
        : REALTIME_SESSION_LIMITS.guestSeconds;

      const closeAll = (code = 1000, reason?: string) => {
        if (client.readyState === WebSocket.OPEN) {
          client.close(code, reason);
        }
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.close(code, reason);
        }
      };

      upstream.on("open", () => {
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
          const eventType = parsed.type as string;
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

      upstream.on("close", (code, reason) => {
        this.logger.warn(
          `Realtime upstream closed (${code}): ${reason.toString()}`,
        );
        if (client.readyState === WebSocket.OPEN) {
          client.close(code, reason.toString());
        }
      });

      upstream.on("error", (error) => {
        this.logger.warn(`Realtime upstream error: ${(error as Error).message}`);
        closeAll(1011, "Realtime upstream error");
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

      client.on("close", () => {
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.close(1000, "Client disconnected");
        }
      });

      client.on("error", (error) => {
        this.logger.warn(`Realtime client error: ${(error as Error).message}`);
        closeAll(1011, "Realtime client error");
      });
    } catch (error) {
      this.logger.warn(
        `Realtime WS connection failed: ${(error as Error).message}`,
      );
      if (client.readyState === WebSocket.OPEN) {
        client.close(1011, "Realtime connection failed");
      }
    }
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

const buildSessionUpdate = (params: {
  instructions: string;
  voice: string;
  turnDetection: typeof REALTIME_DEFAULT_TURN_DETECTION;
  transcribeModel?: string;
}) => {
  return {
    type: "session.update",
    session: {
      instructions: params.instructions,
      voice: params.voice,
      turn_detection: params.turnDetection,
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      input_audio_transcription: {
        // Realtime API only supports whisper-1 for input transcription.
        // The transcribeModel env var is for the regular audio API.
        model: "whisper-1",
      },
      modalities: ["audio", "text"],
    },
  };
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
