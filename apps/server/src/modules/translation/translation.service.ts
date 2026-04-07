import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { envConfig } from "../../common/config/env.config";
import {
  applyThinkingToggle,
  isQwenModel,
  resolveChatModelRoute,
} from "../../common/config/model-provider.config";
import {
  buildTranslationSystemPrompt,
  buildTranslationUserPrompt,
} from "../../common/config/prompts/translation.prompts";
import { LanguageCode } from "../../common/enums/language-code.enum";
import { TranslationRecord } from "../../common/types/conversation.types";
import { PrismaService } from "../../core/prisma/prisma.service";
import { CreateTranslationDto } from "./dto/create-translation.dto";

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly history: TranslationRecord[] = [];
  private readonly dictionary = this.buildDictionary();

  constructor(private readonly prisma: PrismaService) {}

  async translate(
    dto: CreateTranslationDto,
    userId?: string,
  ): Promise<TranslationRecord> {
    if (
      !this.prisma.canUseDatabase() &&
      !this.prisma.allowsInMemoryFallback()
    ) {
      this.prisma.ensurePersistentStorageAvailable();
    }

    const translated = await this.performTranslation(
      dto.text,
      dto.sourceLanguage,
      dto.targetLanguage,
    );
    const record: TranslationRecord = {
      id: randomUUID(),
      sourceLanguage: dto.sourceLanguage,
      targetLanguage: dto.targetLanguage,
      sourceText: dto.text.trim(),
      translatedText: translated.text,
      romanization: translated.romanization,
      cultureNote: translated.cultureNote,
      variations: translated.variations,
      createdAt: new Date().toISOString(),
    };

    if (this.prisma.canUseDatabase()) {
      try {
        await this.prisma.translationRecord.create({
          data: {
            id: record.id,
            sourceLanguage: record.sourceLanguage,
            targetLanguage: record.targetLanguage,
            sourceText: record.sourceText,
            translatedText: record.translatedText,
            romanization: record.romanization,
            cultureNote: record.cultureNote,
            userId,
          },
        });
      } catch (error) {
        if (this.isDatabaseConnectionError(error)) {
          this.prisma.markDatabaseUnavailable(
            "Translation record persistence failed (P1001/P1002).",
          );
          this.prisma.ensurePersistentStorageAvailable();
        }
        throw error;
      }
    } else {
      this.history.unshift(record);
      this.history.splice(8);
    }

    return record;
  }

  async listHistory(userId?: string): Promise<TranslationRecord[]> {
    if (
      !this.prisma.canUseDatabase() &&
      !this.prisma.allowsInMemoryFallback()
    ) {
      this.prisma.ensurePersistentStorageAvailable();
    }

    if (!userId) {
      return [];
    }

    if (this.prisma.canUseDatabase()) {
      try {
        const records = await this.prisma.translationRecord.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 8,
        });
        return records.map((record) => ({
          id: record.id,
          sourceLanguage: record.sourceLanguage as LanguageCode,
          targetLanguage: record.targetLanguage as LanguageCode,
          sourceText: record.sourceText,
          translatedText: record.translatedText,
          romanization: record.romanization ?? undefined,
          cultureNote: record.cultureNote ?? undefined,
          variations: [],
          createdAt: record.createdAt.toISOString(),
        }));
      } catch (error) {
        if (this.isDatabaseConnectionError(error)) {
          this.prisma.markDatabaseUnavailable(
            "Translation history query failed (P1001/P1002).",
          );
          this.prisma.ensurePersistentStorageAvailable();
        }
        throw error;
      }
    }

    return [];
  }

  private isDatabaseConnectionError(error: unknown): boolean {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
    ) {
      const code = (error as { code: string }).code;
      return code === "P1001" || code === "P1002";
    }
    return false;
  }

  private async performTranslation(
    text: string,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
  ) {
    const normalized = text.trim();

    if (sourceLanguage === targetLanguage) {
      return {
        text: normalized,
        romanization: this.toRomanization(normalized, targetLanguage),
        cultureNote: "源语言与目标语言相同，已保持原文。",
        variations: [],
      };
    }

    const key = normalized.toLowerCase();
    const entry = this.dictionary[key];
    if (entry) {
      const resultText = entry[targetLanguage];
      return {
        text: resultText,
        romanization: entry.romanization[targetLanguage],
        cultureNote: entry.cultureNote,
        variations: entry.variations[targetLanguage],
      };
    }

    this.logger.debug(
      `Dictionary miss for text "${normalized}", synthesizing translation.`,
    );
    const aiTranslation = await this.requestAiTranslation(
      normalized,
      sourceLanguage,
      targetLanguage,
    );
    if (aiTranslation) {
      return {
        text: aiTranslation,
        romanization: this.toRomanization(aiTranslation, targetLanguage),
        cultureNote: "AI 翻译结果，供快速理解使用。",
        variations: [],
      };
    }

    return {
      text: normalized,
      romanization: this.toRomanization(normalized, targetLanguage),
      cultureNote: "暂未取得翻译，保留原文。",
      variations: [],
    };
  }

  private toRomanization(text: string, target: LanguageCode): string {
    if (target === LanguageCode.Cantonese) {
      return "nei5 hou2";
    }
    if (target === LanguageCode.Mandarin) {
      return "nǐ hǎo";
    }
    return text;
  }

  private buildDictionary() {
    return {
      你好: {
        mandarin: "你好",
        cantonese: "你好",
        english: "Hello",
        romanization: {
          mandarin: "nǐ hǎo",
          cantonese: "nei5 hou2",
          english: "hello",
        },
        cultureNote: "问候前可加上称呼显得更礼貌。",
        variations: {
          mandarin: [
            { label: "口语", text: "嗨，你好！" },
            { label: "正式", text: "您好，很高兴见到您。" },
          ],
          cantonese: [
            { label: "地道", text: "早晨！" },
            { label: "亲切", text: "你好吖～" },
          ],
          english: [
            { label: "Formal", text: "Good morning." },
            { label: "Friendly", text: "Hey there!" },
          ],
        },
      },
      谢谢: {
        mandarin: "谢谢",
        cantonese: "多谢晒",
        english: "Thank you so much",
        romanization: {
          mandarin: "xiè xiè nǐ",
          cantonese: "do1 ze6 saai3",
          english: "thank you",
        },
        cultureNote: "粤语中常在感谢后补一句“唔使客气”。",
        variations: {
          mandarin: [
            { label: "口语", text: "太感谢啦！" },
            { label: "正式", text: "非常感谢您的帮助。" },
          ],
          cantonese: [
            { label: "日常", text: "唔该晒你啊！" },
            { label: "正式", text: "多謝你嘅支持。" },
          ],
          english: [
            { label: "Formal", text: "I sincerely appreciate your help." },
            { label: "Casual", text: "Thanks a ton!" },
          ],
        },
      },
    } as Record<
      string,
      {
        mandarin: string;
        cantonese: string;
        english: string;
        romanization: Record<LanguageCode, string>;
        cultureNote: string;
        variations: Record<
          LanguageCode,
          Array<{ label: string; text: string }>
        >;
      }
    >;
  }

  private async requestAiTranslation(
    text: string,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
  ): Promise<string | undefined> {
    const preferredModel =
      envConfig.modelRouting.translationModel ||
      envConfig.modelRouting.secondaryModel ||
      envConfig.modelRouting.primaryModel ||
      envConfig.modelRouting.thirdModel;
    const route = resolveChatModelRoute(preferredModel);
    if (!route) {
      return undefined;
    }

    const body: Record<string, unknown> = {
      model: route.model,
      temperature: 0.1,
      stream: false,
      messages: [
        {
          role: "system",
          content: buildTranslationSystemPrompt(),
        },
        {
          role: "user",
          content: buildTranslationUserPrompt({
            text,
            sourceLanguage,
            targetLanguage,
          }),
        },
      ],
    };
    applyThinkingToggle(body, route.model, false);

    if (/^qwen-mt/i.test(route.model)) {
      body.messages = [
        {
          role: "user",
          content: text,
        },
      ];
      body.translation_options = {
        source_lang: this.toMtLanguage(sourceLanguage),
        target_lang: this.toMtLanguage(targetLanguage),
      };
    } else if (isQwenModel(route.model)) {
      body.response_format = { type: "json_object" };
      body.messages = [
        {
          role: "system",
          content: buildTranslationSystemPrompt({ jsonMode: true }),
        },
        {
          role: "user",
          content: buildTranslationUserPrompt({
            text,
            sourceLanguage,
            targetLanguage,
          }),
        },
      ];
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.resolveModelTimeout(route.model),
    );
    const response = await fetch(route.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${route.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!response.ok) {
      this.logger.warn(
        `Translation request failed (${response.status}) for model ${route.model}`,
      );
      return undefined;
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?:
            | string
            | Array<
                | { type?: string; text?: string }
                | { type?: string; input_text?: string }
              >;
        };
      }>;
    };
    const content = this.extractMessageContent(
      data.choices?.[0]?.message?.content,
    );
    if (!content) {
      return undefined;
    }
    if (isQwenModel(route.model) && !/^qwen-mt/i.test(route.model)) {
      try {
        const parsed = JSON.parse(content) as { translation?: string };
        return parsed.translation?.trim() || undefined;
      } catch {
        return undefined;
      }
    }
    return content.trim() || undefined;
  }

  private toMtLanguage(language: LanguageCode): string {
    switch (language) {
      case LanguageCode.Cantonese:
        return "Cantonese";
      case LanguageCode.Mandarin:
        return "Chinese";
      case LanguageCode.English:
        return "English";
      default:
        return language;
    }
  }

  private extractMessageContent(
    content:
      | string
      | Array<
          | { type?: string; text?: string }
          | { type?: string; input_text?: string }
        >
      | undefined,
  ): string {
    if (typeof content === "string") {
      return content.trim();
    }
    if (!Array.isArray(content)) {
      return "";
    }
    return content
      .map((item) => {
        if (typeof item !== "object" || item === null) {
          return "";
        }
        if ("text" in item && typeof item.text === "string") {
          return item.text;
        }
        if ("input_text" in item && typeof item.input_text === "string") {
          return item.input_text;
        }
        return "";
      })
      .join("\n")
      .trim();
  }

  private resolveModelTimeout(model: string): number {
    if (model === envConfig.modelRouting.thirdModel) {
      return envConfig.modelTimeoutMs.third;
    }
    if (model === envConfig.modelRouting.secondaryModel) {
      return envConfig.modelTimeoutMs.secondary;
    }
    return envConfig.modelTimeoutMs.primary;
  }
}
