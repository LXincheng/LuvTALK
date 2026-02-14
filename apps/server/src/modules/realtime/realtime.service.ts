import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { envConfig } from "../../common/config/env.config";
import { buildRealtimeSystemPrompt } from "../../common/config/prompt.config";
import { LanguageCode } from "../../common/enums/language-code.enum";
import { ConversationService } from "../conversation/conversation.service";
import { CreateRealtimeOfferDto } from "./dto/create-realtime-offer.dto";
import { SaveRealtimeTranscriptDto } from "./dto/save-realtime-transcript.dto";
import {
  REALTIME_DEFAULT_TURN_DETECTION,
  REALTIME_DEFAULT_VOICE,
  REALTIME_SESSION_LIMITS,
  REALTIME_OFFER_COOLDOWN_MS,
} from "./realtime.constants";

export interface RealtimeSessionConfig {
  apiUrl: string;
  model: string;
  voice: string;
  instructions: string;
  turnDetection: typeof REALTIME_DEFAULT_TURN_DETECTION;
  iceServers?: IceServer[];
}

export interface RealtimeOfferResult {
  answerSdp: string;
  sessionConfig: RealtimeSessionConfig;
  maxSessionSeconds: number;
}

export interface RealtimeTranscriptEntry {
  role: "user" | "ai";
  text: string;
  timestamp?: string;
}

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly offerCooldown = new Map<string, number>();

  constructor(private readonly conversationService: ConversationService) {}

  async createOffer(
    dto: CreateRealtimeOfferDto,
    userId?: string,
  ): Promise<RealtimeOfferResult> {
    const { apiKey, realtimeApiUrl, realtimeModel } = envConfig.openai;
    if (!apiKey || !realtimeApiUrl || !realtimeModel) {
      throw new ServiceUnavailableException("Realtime service unavailable");
    }
    const session = await this.conversationService.getSession(
      dto.conversationId,
    );
    if (session.userId && (!userId || session.userId !== userId)) {
      throw new NotFoundException("Conversation not found");
    }
    if (!session.userId && userId) {
      session.userId = userId;
      await this.conversationService.persistSessionPublic(session);
    }

    const scenarioLabel = dto.scenarioId ?? session.scenarioId ?? "daily";
    const prompt = buildRealtimeSystemPrompt({
      targetLanguage: session.targetLanguage,
      nativeLanguage: session.nativeLanguage ?? LanguageCode.Mandarin,
      scenarioLabel,
    });

    const cooldownKey = userId
      ? `user:${userId}`
      : `guest:${dto.conversationId}`;
    const now = Date.now();
    const lastIssued = this.offerCooldown.get(cooldownKey);
    if (lastIssued && now - lastIssued < REALTIME_OFFER_COOLDOWN_MS) {
      throw new HttpException(
        "Too many realtime sessions",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.offerCooldown.set(cooldownKey, now);

    const voice = dto.voice?.trim() || REALTIME_DEFAULT_VOICE;
    const turnDetection = REALTIME_DEFAULT_TURN_DETECTION;
    const realtimeBaseUrl = normalizeRealtimeBase(realtimeApiUrl);

    this.logger.log(
      `Realtime offer request -> ${realtimeBaseUrl}?model=${realtimeModel}`,
    );

    const response = await fetch(
      `${realtimeBaseUrl}?model=${encodeURIComponent(realtimeModel)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
          Authorization: `Bearer ${apiKey}`,
          "OpenAI-Beta": "realtime=v1",
        },
        body: dto.offerSdp,
      },
    );

    if (!response.ok) {
      const detail = await safeReadText(response);
      this.logger.warn(
        `Realtime offer failed (${response.status}): ${detail}`,
      );
      throw new ServiceUnavailableException("Realtime offer failed");
    }

    const answerSdp = await response.text();
    if (!answerSdp?.trim()) {
      throw new ServiceUnavailableException("Realtime answer missing");
    }
    const maxSessionSeconds = userId
      ? REALTIME_SESSION_LIMITS.authSeconds
      : REALTIME_SESSION_LIMITS.guestSeconds;

    return {
      answerSdp,
      maxSessionSeconds,
      sessionConfig: {
        apiUrl: realtimeBaseUrl,
        model: realtimeModel,
        voice,
        instructions: prompt,
        turnDetection,
      },
    };
  }

  async saveTranscript(
    dto: SaveRealtimeTranscriptDto,
    userId?: string,
  ): Promise<{ saved: number }> {
    if (!dto.messages?.length) {
      return { saved: 0 };
    }
    const cleaned: RealtimeTranscriptEntry[] = dto.messages
      .map((entry) => ({
        role: entry.role,
        text: entry.text?.trim(),
        timestamp: entry.timestamp,
      }))
      .filter((entry) => entry.text);

    if (!cleaned.length) {
      return { saved: 0 };
    }

    const saved = await this.conversationService.appendRealtimeTranscript(
      dto.conversationId,
      cleaned,
      userId,
    );
    return { saved };
  }
}

const normalizeApiUrl = (value: string): string => value.replace(/\/$/, "");

const normalizeRealtimeBase = (value: string): string => {
  const normalized = normalizeApiUrl(value);
  if (normalized.endsWith("/realtime")) {
    return normalized;
  }
  return `${normalized}/realtime`;
};

const safeReadText = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch {
    return "";
  }
};
