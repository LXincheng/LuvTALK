import { Global, Module } from "@nestjs/common";
import { SessionCacheService } from "./session-cache.service";
import { VoiceOperationCacheService } from "./voice-operation-cache.service";

@Global()
@Module({
  providers: [SessionCacheService, VoiceOperationCacheService],
  exports: [SessionCacheService, VoiceOperationCacheService],
})
export class AppCacheModule {}
