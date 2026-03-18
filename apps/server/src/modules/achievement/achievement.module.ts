import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AchievementController } from "./achievement.controller";
import { AchievementService } from "./achievement.service";

@Module({
  imports: [AuthModule],
  controllers: [AchievementController],
  providers: [AchievementService],
  exports: [AchievementService],
})
export class AchievementModule {}
