import { Module } from "@nestjs/common";
import { AchievementModule } from "../achievement/achievement.module";
import { TranslationModule } from "../translation/translation.module";
import { ConversationController } from "./conversation.controller";
import { ConversationReportService } from "./conversation-report.service";
import { ConversationService } from "./conversation.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [TranslationModule, AuthModule, AchievementModule],
  controllers: [ConversationController],
  providers: [ConversationService, ConversationReportService],
  exports: [ConversationService, ConversationReportService],
})
export class ConversationModule {}
