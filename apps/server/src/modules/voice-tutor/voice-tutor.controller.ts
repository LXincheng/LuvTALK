import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { Request, Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { AuthService } from "../auth/auth.service";
import { SynthesizeVoiceDto } from "./dto/synthesize-voice.dto";
import { MAX_FILE_SIZE_BYTES, VoiceTutorService } from "./voice-tutor.service";

const ACCEPTED_MIME_TYPES = new Set([
  "audio/webm",
  "video/webm",
  "audio/wav",
  "audio/m4a",
  "audio/mp4",
  "video/mp4",
  "audio/mpeg",
]);

@Controller("conversation")
export class VoiceTutorController {
  constructor(
    private readonly voiceTutor: VoiceTutorService,
    private readonly authService: AuthService,
  ) {}

  @Post(":conversationId/voice")
  @UseInterceptors(
    FileInterceptor("audio", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
          return callback(new BadRequestException("不支持的音频格式"), false);
        }
        callback(null, true);
      },
    }),
  )
  async uploadVoice(
    @Param("conversationId") conversationId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException("缺少音频文件");
    }
    const profile = await this.authService.resolveUserFromRequest(req);
    const result = await this.voiceTutor.handleUpload(
      conversationId,
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
      },
      profile?.id,
      resolveConversationKey(req),
    );
    return {
      operationId: result.operationId,
      status: "received",
    };
  }

  @Get(":conversationId/voice-status/:operationId")
  async getVoiceOperationStatus(
    @Param("conversationId") conversationId: string,
    @Param("operationId") operationId: string,
    @Req() req: Request,
  ) {
    const profile = await this.authService.resolveUserFromRequest(req);
    const snapshot = await this.voiceTutor.getVoiceOperationStatus(
      conversationId,
      operationId,
      profile?.id,
      resolveConversationKey(req),
    );
    if (!snapshot) {
      throw new NotFoundException("Pending voice operation not found");
    }
    return snapshot;
  }

  @Post(":conversationId/tts")
  async synthesizeSpeech(
    @Param("conversationId") conversationId: string,
    @Body() dto: SynthesizeVoiceDto,
    @Req() req: Request,
  ) {
    const normalized = dto.text?.trim();
    if (!normalized) {
      throw new BadRequestException("合成内容不能为空");
    }
    const profile = await this.authService.resolveUserFromRequest(req);
    const payload = await this.voiceTutor.synthesizeSpeech(
      conversationId,
      normalized,
      dto.voice?.trim() || undefined,
      profile?.id,
      resolveConversationKey(req),
    );
    if (!payload) {
      throw new ServiceUnavailableException("语音合成暂不可用");
    }
    return payload;
  }

  @Get(":conversationId/voice/:fileName")
  async streamVoiceFile(
    @Param("conversationId") conversationId: string,
    @Param("fileName") fileName: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const profile = await this.authService.resolveUserFromRequest(req);
    const { stream, mimeType } = await this.voiceTutor.openAudioStream(
      conversationId,
      fileName,
      profile?.id,
      resolveConversationKey(req),
    );
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    return new StreamableFile(stream);
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
