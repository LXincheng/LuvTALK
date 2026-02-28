import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConversationModule } from "../conversation/conversation.module";
import { LearningGoalController } from "./learning-goal.controller";
import { LearningGoalService } from "./learning-goal.service";

@Module({
  imports: [AuthModule, ConversationModule],
  controllers: [LearningGoalController],
  providers: [LearningGoalService],
})
export class LearningGoalModule {}
