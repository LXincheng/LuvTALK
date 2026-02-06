import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { ReviewService } from "./review.service";
import { ReviewFeedbackDto } from "./dto/review-feedback.dto";

@Controller("review")
export class ReviewController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly authService: AuthService,
  ) {}

  @Get("daily")
  async getDailyReview(@Req() req: Request) {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.reviewService.buildDailyReview(profile?.id);
  }

  @Post("feedback")
  async submitFeedback(@Body() dto: ReviewFeedbackDto, @Req() req: Request) {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.reviewService.recordFeedback(dto, profile?.id);
  }
}
