import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join, extname } from "path";
import { ConversationService } from "../conversation/conversation.service";

const DEFAULT_STORAGE_ROOT = join(process.cwd(), "tmp", "voice-uploads");
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB upper bound for raw buffer guard

export interface VoiceUploadFile {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
}

export interface VoiceUploadResult {
  operationId: string;
  filePath: string;
  mimeType: string;
}

@Injectable()
export class VoiceTutorService {
  private readonly logger = new Logger(VoiceTutorService.name);
  private readonly storageRoot = DEFAULT_STORAGE_ROOT;

  constructor(private readonly conversationService: ConversationService) {}

  async handleUpload(
    conversationId: string,
    file: VoiceUploadFile,
  ): Promise<VoiceUploadResult> {
    if (!file?.buffer?.length) {
      throw new BadRequestException("文件内容为空");
    }
    if (file.buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException("音频文件过大");
    }

    // 验证会话是否存在（若无则会抛异常）
    await this.conversationService.getSession(conversationId);

    const operationId = `voice-op-${Date.now()}-${randomUUID()}`;
    const extension = this.resolveExtension(file);
    const directory = join(this.storageRoot, conversationId);
    const fileName = `${operationId}${extension}`;
    const filePath = join(directory, fileName);

    await mkdir(directory, { recursive: true });
    await writeFile(filePath, file.buffer);

    this.logger.debug(
      `Stored voice upload for ${conversationId} -> ${filePath} (${file.mimetype})`,
    );

    return {
      operationId,
      filePath,
      mimeType: file.mimetype,
    };
  }

  private resolveExtension(file: VoiceUploadFile): string {
    if (file.originalname) {
      const originalExt = extname(file.originalname);
      if (originalExt) {
        return originalExt.toLowerCase();
      }
    }
    if (file.mimetype === "audio/webm" || file.mimetype === "video/webm") {
      return ".webm";
    }
    if (file.mimetype === "audio/wav") {
      return ".wav";
    }
    if (
      file.mimetype === "audio/m4a" ||
      file.mimetype === "audio/mp4" ||
      file.mimetype === "video/mp4"
    ) {
      return ".m4a";
    }
    if (file.mimetype === "audio/mpeg") {
      return ".mp3";
    }
    return ".bin";
  }
}
