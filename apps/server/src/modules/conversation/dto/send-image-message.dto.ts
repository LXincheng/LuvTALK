import { IsOptional, IsString, MaxLength } from "class-validator";

export class SendImageMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(400)
  message?: string;
}
