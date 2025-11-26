import { Module } from "@nestjs/common";
import { TranslationModule } from "../translation/translation.module";
import { ConversationController } from "./conversation.controller";
import { ConversationService } from "./conversation.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [TranslationModule, AuthModule],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
