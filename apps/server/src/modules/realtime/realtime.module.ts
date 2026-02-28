import { Module } from "@nestjs/common";
import { RealtimeController } from "./realtime.controller";
import { RealtimeService } from "./realtime.service";
import { RealtimeWsProxy } from "./realtime.ws";
import { ConversationModule } from "../conversation/conversation.module";
import { AuthModule } from "../auth/auth.module";
import { RealtimeMetricsService } from "./realtime-metrics.service";

@Module({
  imports: [ConversationModule, AuthModule],
  controllers: [RealtimeController],
  providers: [RealtimeService, RealtimeWsProxy, RealtimeMetricsService],
  exports: [RealtimeWsProxy],
})
export class RealtimeModule {}
