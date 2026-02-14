import { Body, Controller, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { RealtimeService } from "./realtime.service";
import { CreateRealtimeOfferDto } from "./dto/create-realtime-offer.dto";
import { SaveRealtimeTranscriptDto } from "./dto/save-realtime-transcript.dto";

@Controller("realtime")
export class RealtimeController {
  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly authService: AuthService,
  ) {}

  @Post("offer")
  async createOffer(
    @Body() dto: CreateRealtimeOfferDto,
    @Req() req: Request,
  ) {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.realtimeService.createOffer(dto, profile?.id);
  }

  @Post("transcript")
  async saveTranscript(
    @Body() dto: SaveRealtimeTranscriptDto,
    @Req() req: Request,
  ) {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.realtimeService.saveTranscript(dto, profile?.id);
  }
}
