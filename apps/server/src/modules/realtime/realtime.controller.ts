import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { RealtimeService } from "./realtime.service";
import { CreateRealtimeOfferDto } from "./dto/create-realtime-offer.dto";
import { SaveRealtimeTranscriptDto } from "./dto/save-realtime-transcript.dto";
import { RealtimeMetricsService } from "./realtime-metrics.service";

@Controller("realtime")
export class RealtimeController {
  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly authService: AuthService,
    private readonly realtimeMetrics: RealtimeMetricsService,
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

  @Get("metrics")
  getMetrics() {
    return this.realtimeMetrics.snapshot();
  }
}
