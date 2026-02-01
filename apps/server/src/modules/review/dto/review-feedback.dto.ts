import { IsEnum, IsIn, IsOptional, IsString } from "class-validator";

export enum ReviewFeedbackAction {
  Known = "known",
  Practice = "practice",
}

export class ReviewFeedbackDto {
  @IsString()
  cardId!: string;

  @IsEnum(ReviewFeedbackAction)
  action!: ReviewFeedbackAction;

  @IsOptional()
  @IsIn(["favorite", "low_score"])
  sourceType?: "favorite" | "low_score";

  @IsOptional()
  @IsString()
  conversationId?: string;
}
