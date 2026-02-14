import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateRealtimeOfferDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  conversationId!: string;

  @IsString()
  @MinLength(10)
  offerSdp!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  voice?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  scenarioId?: string;
}
