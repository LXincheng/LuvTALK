import { IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { TutorInteractionMode } from "../../../common/config/prompt.config";

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  message!: string;

  @IsOptional()
  @IsString()
  @IsIn(["text", "voice", "immersive", "review"] satisfies TutorInteractionMode[])
  mode?: TutorInteractionMode;
}
