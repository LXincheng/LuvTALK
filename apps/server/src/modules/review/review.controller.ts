import { Body, Controller, Get, Post } from "@nestjs/common";
import { ReviewService } from "./review.service";
import { ReviewFeedbackDto } from "./dto/review-feedback.dto";

@Controller("review")
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get("daily")
  getDailyReview() {
    return this.reviewService.buildDailyReview();
  }

  @Post("feedback")
  submitFeedback(@Body() dto: ReviewFeedbackDto) {
    return this.reviewService.recordFeedback(dto);
  }
}
