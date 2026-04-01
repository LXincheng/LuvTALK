import { IsBoolean, IsOptional } from "class-validator";

export class UpdateConversationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  memoryEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  deepThinkingEnabled?: boolean;
}
