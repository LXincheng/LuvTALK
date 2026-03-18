import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Sse,
  MessageEvent,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { from, Observable } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import { ConversationService } from "./conversation.service";
import { StartConversationDto } from "./dto/start-conversation.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { UpdateConversationPreferencesDto } from "./dto/update-conversation-preferences.dto";
import { AuthService } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SessionSummaryPayload } from "./conversation-summary.types";

@Controller("conversation")
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly authService: AuthService,
  ) {}

  @Post("session")
  async startSession(@Body() dto: StartConversationDto, @Req() req: Request) {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.conversationService.startSession(dto, profile?.id);
  }

  @Post("resume")
  async resumeSession(@Body() dto: StartConversationDto, @Req() req: Request) {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.conversationService.resumeOrCreateSession(
      dto,
      profile?.id,
      resolveConversationKey(req),
    );
  }

  @Post(":conversationId/archive")
  async archiveConversation(
    @Param("conversationId") conversationId: string,
    @Req() req: Request,
  ) {
    const profile = await this.authService.resolveUserFromRequest(req);
    await this.conversationService.archiveConversation(
      conversationId,
      profile?.id,
      resolveConversationKey(req),
    );
    return { status: "archived" };
  }

  @Post(":conversationId/preferences")
  async updatePreferences(
    @Param("conversationId") conversationId: string,
    @Body() dto: UpdateConversationPreferencesDto,
    @Req() req: Request,
  ) {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.conversationService.updateSessionPreferences(
      conversationId,
      dto,
      profile?.id,
      resolveConversationKey(req),
    );
  }

  @Post(":conversationId/message")
  async sendMessage(
    @Param("conversationId") conversationId: string,
    @Body() dto: SendMessageDto,
    @Req() req: Request,
  ) {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.conversationService.processMessage(
      conversationId,
      dto,
      undefined,
      profile?.id,
      resolveConversationKey(req),
    );
  }

  @Post("history")
  async listHistory(@Body() body: { ids?: string[] }, @Req() req: Request) {
    const profile = await this.authService.resolveUserFromRequest(req);
    if (profile?.id) {
      return this.conversationService.listUserHistory(profile.id);
    }
    // Guest users: look up by conversation IDs sent from localStorage
    if (Array.isArray(body?.ids) && body.ids.length > 0) {
      return this.conversationService.listByIds(body.ids);
    }
    return [];
  }

  @Get(":conversationId")
  async getSession(
    @Param("conversationId") conversationId: string,
    @Req() req: Request,
  ) {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.conversationService.getAccessibleSession(conversationId, {
      userId: profile?.id,
      conversationKey: resolveConversationKey(req),
      allowBootstrapMissingAccessKey: true,
    });
  }

  @Get(":conversationId/summary")
  async getSummary(
    @Param("conversationId") conversationId: string,
    @Req() req: Request,
  ): Promise<SessionSummaryPayload> {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.conversationService.getSessionSummary(
      conversationId,
      profile?.id,
      resolveConversationKey(req),
    );
  }

  @Get(":conversationId/history")
  @UseGuards(JwtAuthGuard)
  async getHistory(
    @Param("conversationId") conversationId: string,
    @Req() req: Request,
  ) {
    return this.conversationService.getConversationHistory(
      conversationId,
      req.user!.id,
    );
  }

  @Sse(":conversationId/events")
  streamSession(
    @Param("conversationId") conversationId: string,
    @Req() req: Request,
  ): Observable<MessageEvent> {
    const conversationKey = resolveConversationKey(req);
    return from(this.authService.resolveUserFromRequest(req)).pipe(
      switchMap((profile) =>
        from(
          this.conversationService.getAccessibleSession(conversationId, {
            userId: profile?.id,
            conversationKey,
            allowBootstrapMissingAccessKey: true,
          }),
        ),
      ),
      switchMap(() => this.conversationService.streamSession(conversationId)),
      map((session) => ({
        data: session,
      })),
    );
  }
}

const resolveConversationKey = (req: Request): string | undefined => {
  const headerValue = req.headers["x-conversation-key"];
  const headerKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const queryKey =
    typeof req.query.conversationKey === "string"
      ? req.query.conversationKey
      : undefined;
  return headerKey?.trim() || queryKey?.trim() || undefined;
};
