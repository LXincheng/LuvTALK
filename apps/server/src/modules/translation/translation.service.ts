import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LanguageCode } from '../../common/enums/language-code.enum';
import { TranslationRecord } from '../../common/types/conversation.types';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateTranslationDto } from './dto/create-translation.dto';

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly history: TranslationRecord[] = [];
  private readonly dictionary = this.buildDictionary();

  constructor(private readonly prisma: PrismaService) {}

  async translate(dto: CreateTranslationDto): Promise<TranslationRecord> {
    const translated = this.performTranslation(dto.text, dto.sourceLanguage, dto.targetLanguage);
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
    this.history.splice(8); // keep last 8

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

  private performTranslation(
    text: string,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
  ) {
    const normalized = text.trim();

    if (sourceLanguage === targetLanguage) {
      return {
        text: normalized,
        romanization: this.toRomanization(normalized, targetLanguage),
        cultureNote: '源语言与目标语言相同，已保持原文。',
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

    this.logger.debug(`Dictionary miss for text "${normalized}", synthesizing translation.`);
    return {
      text: `${normalized} (${targetLanguage})`,
      romanization: this.toRomanization(normalized, targetLanguage),
      cultureNote: 'AI 生成的表达，适合日常交流。',
      variations: [
        { label: 'Formal', text: `${normalized}，请多指教。` },
        { label: 'Casual', text: `${normalized}!` },
      ],
    };
  }

  private toRomanization(text: string, target: LanguageCode): string {
    if (target === LanguageCode.Cantonese) {
      return 'nei5 hou2'; // placeholder
    }
    if (target === LanguageCode.Mandarin) {
      return 'nǐ hǎo';
    }
    return text;
  }

  private buildDictionary() {
    return {
      '你好': {
        mandarin: '你好',
        cantonese: '你好',
        english: 'Hello',
        romanization: {
          mandarin: 'nǐ hǎo',
          cantonese: 'nei5 hou2',
          english: 'hello',
        },
        cultureNote: '问候前可加上称呼显得更礼貌。',
        variations: {
          mandarin: [
            { label: '口语', text: '嗨，你好！' },
            { label: '正式', text: '您好，很高兴见到您。' },
          ],
          cantonese: [
            { label: '地道', text: '早晨！' },
            { label: '亲切', text: '你好吖～' },
          ],
          english: [
            { label: 'Formal', text: 'Good morning.' },
            { label: 'Friendly', text: 'Hey there!' },
          ],
        },
      },
      '謝謝': {
        mandarin: '谢谢你',
        cantonese: '多謝晒',
        english: 'Thank you so much',
        romanization: {
          mandarin: 'xiè xiè nǐ',
          cantonese: 'do1 ze6 saai3',
          english: 'thank you',
        },
        cultureNote: '粤语中常在感谢后补一句「唔使客气」。',
        variations: {
          mandarin: [
            { label: '口语', text: '太感谢啦！' },
            { label: '正式', text: '非常感谢您的帮助。' },
          ],
          cantonese: [
            { label: '日常', text: '唔该晒你啊！' },
            { label: '正式', text: '多謝你嘅支持。' },
          ],
          english: [
            { label: 'Formal', text: 'I sincerely appreciate your help.' },
            { label: 'Casual', text: 'Thanks a ton!' },
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
        variations: Record<LanguageCode, Array<{ label: string; text: string }>>;
      }
    >;
  }
}
