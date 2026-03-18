import { Injectable, Logger } from "@nestjs/common";

export type VoiceOperationStatus =
  | "received"
  | "transcribing"
  | "responding"
  | "completed"
  | "failed";

export interface VoiceOperationSnapshot {
  operationId: string;
  conversationId: string;
  status: VoiceOperationStatus;
  audioUrl?: string;
  transcript?: string;
  error?: string;
  updatedAt: string;
}

@Injectable()
export class VoiceOperationCacheService {
  private readonly logger = new Logger(VoiceOperationCacheService.name);
  private readonly ttlSeconds = 5 * 60;
  private readonly cache = new Map<string, VoiceOperationSnapshot>();

  getSnapshot(
    operationId: string,
  ): Promise<VoiceOperationSnapshot | undefined> {
    try {
      return Promise.resolve(this.cache.get(this.buildKey(operationId)));
    } catch (error) {
      this.logger.warn(
        `Failed to read voice-op cache ${operationId}: ${
          (error as Error).message
        }`,
      );
      return Promise.resolve(undefined);
    }
  }

  saveSnapshot(
    snapshot: VoiceOperationSnapshot,
  ): Promise<VoiceOperationSnapshot> {
    try {
      // 当前仅使用内存 Map 保存语音操作快照，TTL 由调用方控制轮询与清理。
      this.cache.set(this.buildKey(snapshot.operationId), snapshot);
    } catch (error) {
      this.logger.warn(
        `Failed to write voice-op cache ${snapshot.operationId}: ${
          (error as Error).message
        }`,
      );
    }
    return Promise.resolve(snapshot);
  }

  async mergeSnapshot(
    conversationId: string,
    operationId: string,
    patch: Partial<
      Omit<VoiceOperationSnapshot, "operationId" | "conversationId">
    > & {
      status?: VoiceOperationStatus;
    },
  ): Promise<VoiceOperationSnapshot> {
    const existing =
      (await this.getSnapshot(operationId)) ??
      ({
        operationId,
        conversationId,
        status: "received",
        updatedAt: new Date().toISOString(),
      } satisfies VoiceOperationSnapshot);
    const next: VoiceOperationSnapshot = {
      ...existing,
      ...patch,
      conversationId,
      operationId,
      updatedAt: new Date().toISOString(),
    };
    return this.saveSnapshot(next);
  }

  private buildKey(operationId: string): string {
    return `voice-op:${operationId}`;
  }
}
