import { Module } from "@nestjs/common";
import { AchievementModule } from "../achievement/achievement.module";
import { AuthModule } from "../auth/auth.module";
import { FavoritesModule } from "../favorites/favorites.module";
import { ConversationModule } from "../conversation/conversation.module";
import { ReviewController } from "./review.controller";
import { ReviewService } from "./review.service";

@Module({
  imports: [AuthModule, FavoritesModule, ConversationModule, AchievementModule],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
