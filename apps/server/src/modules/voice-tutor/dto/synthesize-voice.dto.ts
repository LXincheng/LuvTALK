import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class SynthesizeVoiceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  voice?: string;
}
