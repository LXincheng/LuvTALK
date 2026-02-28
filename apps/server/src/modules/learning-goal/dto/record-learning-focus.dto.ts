import { IsInt, Max, Min } from "class-validator";

export class RecordLearningFocusDto {
  @IsInt()
  @Min(15)
  @Max(600)
  focusSeconds!: number;
}
