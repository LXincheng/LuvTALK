import { Body, Controller, Get, Post } from '@nestjs/common';
import { TranslationService } from './translation.service';
import { CreateTranslationDto } from './dto/create-translation.dto';

@Controller('translation')
export class TranslationController {
  constructor(private readonly translationService: TranslationService) {}

  @Post('convert')
  translate(@Body() dto: CreateTranslationDto) {
    return this.translationService.translate(dto);
  }

  @Get('history')
  history() {
    return this.translationService.listHistory();
  }
}
