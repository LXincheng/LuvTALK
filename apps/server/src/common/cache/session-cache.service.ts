import { Injectable, Logger } from "@nestjs/common";
import { ConversationSession } from "../../common/types/conversation.types";

@Injectable()
export class SessionCacheService {
  private readonly logger = new Logger(SessionCacheService.name);
  private readonly ttlSeconds = 60;
  private readonly cache = new Map<string, ConversationSession>();

  getSession(conversationId: string): Promise<ConversationSession | undefined> {
    try {
      return Promise.resolve(this.cache.get(this.buildKey(conversationId)));
    } catch (error) {
      this.logger.warn(
        `Failed to read session cache for ${conversationId}: ${
          (error as Error).message
        }`,
      );
      return Promise.resolve(undefined);
    }
  }

  setSession(session: ConversationSession): Promise<void> {
    try {
      // 当前仅使用内存 Map 作为轻量缓存，TTL 通过上层逻辑控制使用频率。
      this.cache.set(this.buildKey(session.id), session);
    } catch (error) {
      this.logger.warn(
        `Failed to write session cache for ${session.id}: ${
          (error as Error).message
        }`,
      );
    }
    return Promise.resolve();
  }

  deleteSession(conversationId: string): Promise<void> {
    try {
      this.cache.delete(this.buildKey(conversationId));
    } catch (error) {
      this.logger.warn(
        `Failed to delete session cache for ${conversationId}: ${
          (error as Error).message
        }`,
      );
    }
    return Promise.resolve();
  }

  private buildKey(conversationId: string): string {
    return `session:${conversationId}`;
  }
}
