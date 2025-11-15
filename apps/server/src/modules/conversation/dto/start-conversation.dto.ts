import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LanguageCode } from '../../../common/enums/language-code.enum';

export class StartConversationDto {
  @IsOptional()
  @IsString()
  scenarioId?: string;

  @IsEnum(LanguageCode)
  targetLanguage!: LanguageCode;
}
