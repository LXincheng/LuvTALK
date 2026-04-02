import {
  Injectable,
} from "@nestjs/common";
import { ConversationService } from "../conversation/conversation.service";
import { SaveRealtimeTranscriptDto } from "./dto/save-realtime-transcript.dto";
import { RealtimeMetricsService } from "./realtime-metrics.service";

export interface RealtimeTranscriptEntry {
  role: "user" | "ai";
  text: string;
  timestamp?: string;
}

@Injectable()
export class RealtimeService {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly realtimeMetrics: RealtimeMetricsService,
  ) {}

  async saveTranscript(
    dto: SaveRealtimeTranscriptDto,
    userId?: string,
    conversationKey?: string,
  ): Promise<{ saved: number }> {
    if (!dto.messages?.length) {
      this.realtimeMetrics.recordTranscriptSaved(0);
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
      this.realtimeMetrics.recordTranscriptSaved(0);
      return { saved: 0 };
    }
    try {
      const saved = await this.conversationService.appendRealtimeTranscript(
        dto.conversationId,
        cleaned,
        userId,
        conversationKey,
      );
      this.realtimeMetrics.recordTranscriptSaved(saved);
      return { saved };
    } catch (error) {
      this.realtimeMetrics.recordTranscriptSaveFailure();
      throw error;
    }
  }
}
