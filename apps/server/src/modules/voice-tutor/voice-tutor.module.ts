import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConversationModule } from "../conversation/conversation.module";
import { VoiceTutorController } from "./voice-tutor.controller";
import { VoiceTutorService } from "./voice-tutor.service";

@Module({
  imports: [ConversationModule, AuthModule],
  controllers: [VoiceTutorController],
  providers: [VoiceTutorService],
  exports: [VoiceTutorService],
})
export class VoiceTutorModule {}
