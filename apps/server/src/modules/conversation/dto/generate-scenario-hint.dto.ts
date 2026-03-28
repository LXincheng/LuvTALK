import { IsIn, IsOptional, IsString } from "class-validator";

export class GenerateScenarioHintDto {
  @IsOptional()
  @IsString()
  @IsIn(["hint", "nudge"])
  kind?: "hint" | "nudge";
}
