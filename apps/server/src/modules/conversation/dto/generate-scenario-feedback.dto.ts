import { IsBoolean, IsOptional } from "class-validator";

export class GenerateScenarioFeedbackDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
