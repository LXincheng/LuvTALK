import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

const MAX_TTS_REQUEST_TEXT_LENGTH = 12_000;

export class SynthesizeVoiceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_TTS_REQUEST_TEXT_LENGTH)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  voice?: string;
}
