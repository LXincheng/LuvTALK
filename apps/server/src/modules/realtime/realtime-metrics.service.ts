import { Injectable } from "@nestjs/common";
import { RealtimeServerErrorCode } from "./realtime-error.types";

interface DurationAggregate {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
}

export interface RealtimeFailureEntry {
  timestamp: string;
  errorCode: RealtimeServerErrorCode;
  wsCode: number;
  retriable: boolean;
  message: string;
}

export interface RealtimeMetricsSnapshot {
  startedAt: string;
  uptimeSeconds: number;
  connections: {
    accepted: number;
    connected: number;
    failed: number;
    reconnectAttempts: number;
  };
  connectDurationMs: {
    avg: number;
    min: number;
    max: number;
    count: number;
  };
  transcripts: {
    saveCalls: number;
    savedMessages: number;
    saveFailures: number;
  };
  failuresByErrorCode: Record<string, number>;
  closesByWsCode: Record<string, number>;
  recentFailures: RealtimeFailureEntry[];
}

const RECENT_FAILURE_LIMIT = 30;

@Injectable()
export class RealtimeMetricsService {
  private readonly startedAt = Date.now();
  private acceptedConnections = 0;
  private connectedConnections = 0;
  private failedConnections = 0;
  private reconnectAttempts = 0;
  private transcriptSavedMessages = 0;
  private transcriptSaveCalls = 0;
  private transcriptSaveFailures = 0;
  private readonly errorCodeCounter = new Map<
    RealtimeServerErrorCode,
    number
  >();
  private readonly wsCloseCodeCounter = new Map<number, number>();
  private readonly connectDuration: DurationAggregate = {
    count: 0,
    totalMs: 0,
    minMs: Number.POSITIVE_INFINITY,
    maxMs: 0,
  };
  private readonly recentFailures: RealtimeFailureEntry[] = [];

  recordConnectionAccepted() {
    this.acceptedConnections += 1;
  }

  recordConnectionEstablished(durationMs: number) {
    this.connectedConnections += 1;
    this.connectDuration.count += 1;
    this.connectDuration.totalMs += durationMs;
    this.connectDuration.minMs = Math.min(
      this.connectDuration.minMs,
      durationMs,
    );
    this.connectDuration.maxMs = Math.max(
      this.connectDuration.maxMs,
      durationMs,
    );
  }

  recordReconnectAttempt() {
    this.reconnectAttempts += 1;
  }

  recordConnectionFailure(params: {
    errorCode: RealtimeServerErrorCode;
    wsCode: number;
    retriable: boolean;
    message: string;
  }) {
    this.failedConnections += 1;
    this.errorCodeCounter.set(
      params.errorCode,
      (this.errorCodeCounter.get(params.errorCode) ?? 0) + 1,
    );
    this.wsCloseCodeCounter.set(
      params.wsCode,
      (this.wsCloseCodeCounter.get(params.wsCode) ?? 0) + 1,
    );
    this.recentFailures.unshift({
      timestamp: new Date().toISOString(),
      errorCode: params.errorCode,
      wsCode: params.wsCode,
      retriable: params.retriable,
      message: params.message,
    });
    if (this.recentFailures.length > RECENT_FAILURE_LIMIT) {
      this.recentFailures.length = RECENT_FAILURE_LIMIT;
    }
  }

  recordWsClosed(code: number) {
    this.wsCloseCodeCounter.set(
      code,
      (this.wsCloseCodeCounter.get(code) ?? 0) + 1,
    );
  }

  recordTranscriptSaved(messageCount: number) {
    this.transcriptSaveCalls += 1;
    this.transcriptSavedMessages += Math.max(0, messageCount);
  }

  recordTranscriptSaveFailure() {
    this.transcriptSaveFailures += 1;
  }

  snapshot(): RealtimeMetricsSnapshot {
    const now = Date.now();
    const connectAverageMs =
      this.connectDuration.count > 0
        ? Math.round(this.connectDuration.totalMs / this.connectDuration.count)
        : 0;

    return {
      startedAt: new Date(this.startedAt).toISOString(),
      uptimeSeconds: Math.floor((now - this.startedAt) / 1000),
      connections: {
        accepted: this.acceptedConnections,
        connected: this.connectedConnections,
        failed: this.failedConnections,
        reconnectAttempts: this.reconnectAttempts,
      },
      connectDurationMs: {
        avg: connectAverageMs,
        min:
          this.connectDuration.count > 0
            ? Math.round(this.connectDuration.minMs)
            : 0,
        max: Math.round(this.connectDuration.maxMs),
        count: this.connectDuration.count,
      },
      transcripts: {
        saveCalls: this.transcriptSaveCalls,
        savedMessages: this.transcriptSavedMessages,
        saveFailures: this.transcriptSaveFailures,
      },
      failuresByErrorCode: Object.fromEntries(this.errorCodeCounter.entries()),
      closesByWsCode: Object.fromEntries(this.wsCloseCodeCounter.entries()),
      recentFailures: this.recentFailures,
    };
  }
}
