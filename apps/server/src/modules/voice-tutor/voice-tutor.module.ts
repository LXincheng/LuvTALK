import { Module } from "@nestjs/common";
import { ConversationModule } from "../conversation/conversation.module";
import { VoiceTutorController } from "./voice-tutor.controller";
import { VoiceTutorService } from "./voice-tutor.service";

@Module({
  imports: [ConversationModule],
  controllers: [VoiceTutorController],
  providers: [VoiceTutorService],
  exports: [VoiceTutorService],
})
export class VoiceTutorModule {}
