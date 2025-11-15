import { IsEnum, IsString, MinLength } from 'class-validator';
import { LanguageCode } from '../../../common/enums/language-code.enum';

export class CreateTranslationDto {
  @IsEnum(LanguageCode)
  sourceLanguage!: LanguageCode;

  @IsEnum(LanguageCode)
  targetLanguage!: LanguageCode;

  @IsString()
  @MinLength(1)
  text!: string;
}
