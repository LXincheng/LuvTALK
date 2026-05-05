import {
  ServiceUnavailableException,
  INestApplication,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { envConfig } from "../../common/config/env.config";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly allowInMemoryFallback =
    envConfig.runtime.allowInMemoryFallback;
  private databaseReady = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectInFlight = false;
  private reconnectDelayMs = 5_000;

  async onModuleInit(): Promise<void> {
    await this.tryConnect("startup");
  }

  enableShutdownHooks(app: INestApplication): void {
    process.on("beforeExit", () => {
      void app.close();
    });
  }

  canUseDatabase(): boolean {
    return this.databaseReady;
  }

  allowsInMemoryFallback(): boolean {
    return this.allowInMemoryFallback;
  }

  getHealthSnapshot(): {
    connected: boolean;
    reconnectScheduled: boolean;
    reconnectInFlight: boolean;
    allowInMemoryFallback: boolean;
    reconnectDelayMs: number;
  } {
    return {
      connected: this.databaseReady,
      reconnectScheduled: Boolean(this.reconnectTimer),
      reconnectInFlight: this.reconnectInFlight,
      allowInMemoryFallback: this.allowInMemoryFallback,
      reconnectDelayMs: this.reconnectDelayMs,
    };
  }

  ensurePersistentStorageAvailable(): void {
    if (this.databaseReady || this.allowInMemoryFallback) {
      return;
    }
    throw new ServiceUnavailableException("Persistent storage unavailable");
  }

  markDatabaseUnavailable(reason: string): void {
    if (!this.databaseReady) {
      this.scheduleReconnect(reason);
      return;
    }
    this.databaseReady = false;
    this.logger.warn(`Prisma connection disabled: ${reason}`);
    this.scheduleReconnect(reason);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.databaseReady) {
      await this.$disconnect();
    }
  }

  isConnectionError(error: unknown): boolean {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
    const message =
      error instanceof Error ? error.message : String(error ?? "");

    return (
      code === "P1001" ||
      code === "P1002" ||
      code === "P2024" ||
      code === "P2028" ||
      /maxclientsinsessionmode|max clients reached|too many clients|connection pool|timed out fetching a new connection/i.test(
        message,
      )
    );
  }

  private async tryConnect(context: string): Promise<void> {
    try {
      await this.$connect();
      this.databaseReady = true;
      this.reconnectDelayMs = 5_000;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.logger.log(
        context === "startup"
          ? "Prisma connected to PostgreSQL"
          : `Prisma reconnected to PostgreSQL (${context})`,
      );
    } catch (error) {
      this.databaseReady = false;
      const detail = `Prisma could not connect to PostgreSQL. Details: ${error}`;
      if (this.allowInMemoryFallback) {
        this.logger.warn(`${detail}. In-memory fallback remains enabled.`);
      } else {
        this.logger.error(
          `${detail}. In-memory business fallback is disabled in the current environment.`,
        );
      }
      this.scheduleReconnect(context);
    }
  }

  private scheduleReconnect(reason: string): void {
    if (this.reconnectTimer || this.reconnectInFlight) {
      return;
    }
    const delay = this.reconnectDelayMs;
    this.logger.warn(`Scheduling Prisma reconnect in ${delay}ms (${reason}).`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectInFlight = true;
      void this.$disconnect()
        .catch(() => undefined)
        .finally(() => {
          void this.tryConnect("background reconnect").finally(() => {
            this.reconnectInFlight = false;
          });
        });
    }, delay);
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 60_000);
  }
}
