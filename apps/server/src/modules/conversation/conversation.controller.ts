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
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { ConversationService } from "./conversation.service";
import { StartConversationDto } from "./dto/start-conversation.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { AuthService } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

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
    return this.conversationService.resumeOrCreateSession(dto, profile?.id);
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
    );
    return { status: "archived" };
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
  getSession(@Param("conversationId") conversationId: string) {
    return this.conversationService.getSession(conversationId);
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
  ): Observable<MessageEvent> {
    return this.conversationService.streamSession(conversationId).pipe(
      map((session) => ({
        data: session,
      })),
    );
  }
}
