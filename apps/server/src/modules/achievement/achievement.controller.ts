import { Controller, Get, Req } from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { AchievementService } from "./achievement.service";
import type {
  AchievementSummary,
  AchievementWithProgress,
  LevelWithProgress,
} from "./achievement.types";

@Controller("achievements")
export class AchievementController {
  constructor(
    private readonly achievementService: AchievementService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async list(@Req() req: Request): Promise<AchievementWithProgress[]> {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.achievementService.listAchievements(profile?.id);
  }

  @Get("levels")
  async listLevels(@Req() req: Request): Promise<LevelWithProgress[]> {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.achievementService.listLevels(profile?.id);
  }

  @Get("summary")
  async summary(@Req() req: Request): Promise<AchievementSummary> {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.achievementService.getSummary(profile?.id);
  }
}
