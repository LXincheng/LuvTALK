import {
  Body,
  Controller,
  Get,
  BadRequestException,
  Param,
  Post,
  Query,
  Req,
  Res,
  Sse,
  MessageEvent,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  StreamableFile,
} from "@nestjs/common";
import { Request, Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { from, Observable } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import { ConversationService } from "./conversation.service";
import { StartConversationDto } from "./dto/start-conversation.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { SendImageMessageDto } from "./dto/send-image-message.dto";
import { AuthService } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SessionSummaryPayload } from "./conversation-summary.types";
import { GenerateConversationReportDto } from "./dto/generate-conversation-report.dto";
import { GenerateScenarioHintDto } from "./dto/generate-scenario-hint.dto";
import { GenerateScenarioFeedbackDto } from "./dto/generate-scenario-feedback.dto";
import { ConversationReportService } from "./conversation-report.service";

@Controller("conversation")
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly authService: AuthService,
    private readonly conversationReportService: ConversationReportService,
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

  @Post(":conversationId/image-message")
  @UseInterceptors(
    FileInterceptor("image", {
      storage: memoryStorage(),
      limits: { fileSize: 6 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype)) {
          return callback(new BadRequestException("不支持的图片格式"), false);
        }
        callback(null, true);
      },
    }),
  )
  async sendImageMessage(
    @Param("conversationId") conversationId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SendImageMessageDto,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException("缺少图片文件");
    }
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.conversationService.processImageMessage(
      conversationId,
      {
        question: dto.message,
        mimeType: file.mimetype,
        buffer: file.buffer,
        originalName: file.originalname,
      },
      profile?.id,
      resolveConversationKey(req),
    );
  }

  @Post(":conversationId/hint")
  async generateScenarioHint(
    @Param("conversationId") conversationId: string,
    @Body() dto: GenerateScenarioHintDto,
    @Req() req: Request,
  ) {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.conversationService.generateScenarioHint(
      conversationId,
      dto.kind ?? "hint",
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

  @Get("reports/history")
  @UseGuards(JwtAuthGuard)
  async listReportHistory(@Req() req: Request) {
    return this.conversationReportService.listUserReports(req.user!.id, 10);
  }

  @Get("reports/:reportId")
  @UseGuards(JwtAuthGuard)
  async getReportById(
    @Param("reportId") reportId: string,
    @Req() req: Request,
  ) {
    return this.conversationReportService.getUserReportById(
      reportId,
      req.user!.id,
    );
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
    @Query("locale") locale: string | undefined,
    @Req() req: Request,
  ): Promise<SessionSummaryPayload> {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.conversationService.getSessionSummary(
      conversationId,
      profile?.id,
      resolveConversationKey(req),
      locale,
    );
  }

  @Get(":conversationId/report")
  async getConversationReport(
    @Param("conversationId") conversationId: string,
    @Req() req: Request,
  ) {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.conversationReportService.getLatestReport(
      conversationId,
      profile?.id,
      resolveConversationKey(req),
    );
  }

  @Post(":conversationId/report")
  async generateConversationReport(
    @Param("conversationId") conversationId: string,
    @Body() dto: GenerateConversationReportDto,
    @Req() req: Request,
  ) {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.conversationReportService.generateReport(
      conversationId,
      dto,
      profile?.id,
      resolveConversationKey(req),
    );
  }

  @Post(":conversationId/scenario-feedback")
  async generateScenarioFeedback(
    @Param("conversationId") conversationId: string,
    @Body() dto: GenerateScenarioFeedbackDto,
    @Req() req: Request,
  ) {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.conversationReportService.generateScenarioFeedback(
      conversationId,
      dto,
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

  @Get(":conversationId/image/:fileName")
  async streamImageFile(
    @Param("conversationId") conversationId: string,
    @Param("fileName") fileName: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const profile = await this.authService.resolveUserFromRequest(req);
    const { stream, mimeType } = await this.conversationService.openImageStream(
      conversationId,
      fileName,
      profile?.id,
      resolveConversationKey(req),
    );
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.setHeader("Content-Disposition", `inline; filename=\"${fileName}\"`);
    return new StreamableFile(stream);
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
