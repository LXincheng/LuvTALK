import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { envConfig } from "../../common/config/env.config";
import { LanguageCode } from "../../common/enums/language-code.enum";
import { TranslationRecord } from "../../common/types/conversation.types";
import { PrismaService } from "../../core/prisma/prisma.service";
import { CreateTranslationDto } from "./dto/create-translation.dto";

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly history: TranslationRecord[] = [];
  private readonly dictionary = this.buildDictionary();
  private readonly fallbackEndpoint = this.resolveFallbackEndpoint();

  constructor(private readonly prisma: PrismaService) {}

  async translate(dto: CreateTranslationDto): Promise<TranslationRecord> {
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

    this.history.unshift(record);
    this.history.splice(8);

    if (this.prisma.canUseDatabase()) {
      await this.prisma.translationRecord.create({
        data: {
          id: record.id,
          sourceLanguage: record.sourceLanguage,
          targetLanguage: record.targetLanguage,
          sourceText: record.sourceText,
          translatedText: record.translatedText,
          romanization: record.romanization,
          cultureNote: record.cultureNote,
        },
      });
    }

    return record;
  }

  listHistory(): TranslationRecord[] {
    return this.history;
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
    const apiKey = envConfig.deepseek.apiKey;
    const endpoint = this.fallbackEndpoint;
    if (!apiKey || !endpoint) {
      return undefined;
    }

    const body = {
      model:
        envConfig.modelRouting.translationModel ||
        envConfig.modelRouting.thirdModel ||
        envConfig.modelRouting.secondaryModel,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful translation assistant. Respond with only the translated sentence.",
        },
        {
          role: "user",
          content: `Translate the following text from ${this.describeLanguage(sourceLanguage)} to ${this.describeLanguage(targetLanguage)}:\n"""${text}"""`,
        },
      ],
      temperature: 0.2,
      stream: false,
    };
    if (!body.model) {
      return undefined;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      this.logger.warn(
        `Secondary provider translation request failed (${response.status})`,
      );
      return undefined;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || undefined;
  }

  private describeLanguage(language: LanguageCode): string {
    switch (language) {
      case LanguageCode.Cantonese:
        return "Cantonese Chinese";
      case LanguageCode.Mandarin:
        return "Mandarin Chinese";
      case LanguageCode.English:
        return "English";
      default:
        return language;
    }
  }

  private resolveFallbackEndpoint(): string | null {
    const raw = envConfig.deepseek.apiUrl;
    if (!raw) {
      return null;
    }
    const normalized = raw.replace(/\/$/, "");
    if (normalized.endsWith("/chat/completions")) {
      return normalized;
    }
    if (normalized.endsWith("/v1")) {
      return `${normalized}/chat/completions`;
    }
    return `${normalized}/v1/chat/completions`;
  }
}
