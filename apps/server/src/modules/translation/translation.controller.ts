import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { TranslationService } from "./translation.service";
import { CreateTranslationDto } from "./dto/create-translation.dto";

@Controller("translation")
export class TranslationController {
  constructor(
    private readonly translationService: TranslationService,
    private readonly authService: AuthService,
  ) {}

  @Post("convert")
  async translate(@Body() dto: CreateTranslationDto, @Req() req: Request) {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.translationService.translate(dto, profile?.id);
  }

  @Get("history")
  async history(@Req() req: Request) {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.translationService.listHistory(profile?.id);
  }
}
