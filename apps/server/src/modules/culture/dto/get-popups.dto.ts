import { IsEnum, IsOptional } from "class-validator";
import { LanguageCode } from "../../../common/enums/language-code.enum";

export class GetCulturePopupsDto {
  @IsEnum(LanguageCode)
  targetLanguage!: LanguageCode;

  @IsOptional()
  @IsEnum(LanguageCode)
  nativeLanguage?: LanguageCode;
}
