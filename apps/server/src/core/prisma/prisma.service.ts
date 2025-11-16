import {
  INestApplication,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private databaseReady = false;

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.databaseReady = true;
      this.logger.log("Prisma connected to PostgreSQL");
    } catch (error) {
      this.databaseReady = false;
      this.logger.warn(
        `Prisma could not connect to PostgreSQL. Falling back to in-memory persistence. Details: ${error}`,
      );
    }
  }

  enableShutdownHooks(app: INestApplication): void {
    process.on("beforeExit", () => {
      void app.close();
    });
  }

  canUseDatabase(): boolean {
    return this.databaseReady;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.databaseReady) {
      await this.$disconnect();
    }
  }
}
