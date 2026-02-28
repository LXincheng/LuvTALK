import { IsInt, Max, Min } from "class-validator";

export class UpsertLearningGoalDto {
  @IsInt()
  @Min(5)
  @Max(180)
  dailyMinutes!: number;

  @IsInt()
  @Min(5)
  @Max(500)
  weeklyWords!: number;

  @IsInt()
  @Min(1)
  @Max(50)
  weeklySpeaking!: number;
}
