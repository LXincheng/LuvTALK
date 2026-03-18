import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../../core/prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getHealth() {
    const db = this.prisma.getHealthSnapshot();
    return {
      status: db.connected ? "ok" : "degraded",
      environment: process.env.NODE_ENV ?? "development",
      database: {
        connected: db.connected,
        reconnectScheduled: db.reconnectScheduled,
        reconnectInFlight: db.reconnectInFlight,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("db")
  getDatabaseHealth() {
    const db = this.prisma.getHealthSnapshot();
    return {
      status: db.connected ? "ok" : "degraded",
      database: db,
      timestamp: new Date().toISOString(),
    };
  }
}
