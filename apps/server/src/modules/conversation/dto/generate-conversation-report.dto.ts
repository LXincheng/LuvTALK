import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { ConversationReportSourceMode } from "../conversation-report.types";

export class GenerateConversationReportDto {
  @IsOptional()
  @IsIn(["immersive", "voice", "text"] satisfies ConversationReportSourceMode[])
  sourceMode?: ConversationReportSourceMode;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  voiceStyle?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  force?: boolean;
}
