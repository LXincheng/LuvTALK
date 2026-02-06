import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { FavoritesModule } from "../favorites/favorites.module";
import { ConversationModule } from "../conversation/conversation.module";
import { ReviewController } from "./review.controller";
import { ReviewService } from "./review.service";

@Module({
  imports: [AuthModule, FavoritesModule, ConversationModule],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
