import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { RecordLearningFocusDto } from "./dto/record-learning-focus.dto";
import { UpsertLearningGoalDto } from "./dto/upsert-learning-goal.dto";
import { LearningGoalService } from "./learning-goal.service";
import { LearningGoalPayload } from "./learning-goal.types";

@Controller("learning-goal")
export class LearningGoalController {
  constructor(
    private readonly learningGoalService: LearningGoalService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async getGoal(@Req() req: Request): Promise<LearningGoalPayload> {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.learningGoalService.getGoal(profile?.id);
  }

  @Post()
  async upsertGoal(
    @Body() dto: UpsertLearningGoalDto,
    @Req() req: Request,
  ): Promise<LearningGoalPayload> {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.learningGoalService.upsertGoal(dto, profile?.id);
  }

  @Post("focus")
  async recordFocus(
    @Body() dto: RecordLearningFocusDto,
    @Req() req: Request,
  ): Promise<LearningGoalPayload> {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.learningGoalService.recordFocus(dto, profile?.id);
  }
}
