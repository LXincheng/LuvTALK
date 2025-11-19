import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import { memoryStorage } from "multer";
import { VoiceTutorService, VoiceUploadFile } from "./voice-tutor.service";

const ALLOWED_MIME_TYPES = [
  "audio/webm",
  "video/webm",
  "audio/wav",
  "audio/mpeg",
  "audio/mp4",
  "video/mp4",
  "audio/m4a",
];

const uploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
};

const isVoiceUploadFile = (value: unknown): value is VoiceUploadFile => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<VoiceUploadFile> & {
    buffer?: unknown;
  };
  return (
    typeof candidate.mimetype === "string" && Buffer.isBuffer(candidate.buffer)
  );
};

@Controller("conversation")
export class VoiceTutorController {
  constructor(private readonly voiceTutorService: VoiceTutorService) {}

  @Post(":conversationId/voice")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor("audio", uploadOptions))
  async uploadVoice(
    @Param("conversationId") conversationId: string,
    @UploadedFile() rawFile?: unknown,
  ) {
    if (!isVoiceUploadFile(rawFile)) {
      throw new BadRequestException("请上传音频文件");
    }
    const file = rawFile;
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException("不支持的音频格式");
    }

    const result = await this.voiceTutorService.handleUpload(
      conversationId,
      file,
    );
    return {
      operationId: result.operationId,
      status: "received",
    };
  }
}
