import { Module } from "@nestjs/common";
import { FavoritesModule } from "../favorites/favorites.module";
import { ConversationModule } from "../conversation/conversation.module";
import { ReviewController } from "./review.controller";
import { ReviewService } from "./review.service";

@Module({
  imports: [FavoritesModule, ConversationModule],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
