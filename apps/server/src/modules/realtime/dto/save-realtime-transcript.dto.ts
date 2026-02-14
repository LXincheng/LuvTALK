import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class RealtimeTranscriptMessageDto {
  @IsIn(["user", "ai"])
  role!: "user" | "ai";

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;

  @IsOptional()
  @IsISO8601()
  timestamp?: string;
}

export class SaveRealtimeTranscriptDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  conversationId!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RealtimeTranscriptMessageDto)
  messages!: RealtimeTranscriptMessageDto[];
}
