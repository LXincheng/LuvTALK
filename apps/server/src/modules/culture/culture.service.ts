import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { envConfig } from "../../common/config/env.config";
import { buildCulturePrompt } from "../../common/config/prompt.config";
import { LanguageCode } from "../../common/enums/language-code.enum";
import { CulturePopup } from "../../common/types/culture.types";

@Injectable()
export class CultureService {
  private readonly logger = new Logger(CultureService.name);

  async listPopups(params: {
    targetLanguage: LanguageCode;
    nativeLanguage?: LanguageCode;
  }): Promise<CulturePopup[]> {
    try {
      return await this.requestCultureCards(
        params.targetLanguage,
        params.nativeLanguage ?? LanguageCode.Mandarin,
      );
    } catch (error) {
      this.logger.warn(
        `Secondary provider cultural cards fallback: ${(error as Error).message}`,
      );
      return this.buildFallback(params.targetLanguage);
    }
  }

  private async requestCultureCards(
    targetLanguage: LanguageCode,
    nativeLanguage: LanguageCode,
  ): Promise<CulturePopup[]> {
    const { apiKey, apiUrl } = envConfig.deepseek;
    const model = envConfig.modelRouting.secondaryModel;
    if (!apiKey || !apiUrl || !model) {
      throw new ServiceUnavailableException(
        "Secondary provider config missing for cultural cards",
      );
    }

    const prompt = buildCulturePrompt({
      targetLanguage,
      nativeLanguage,
    });

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Provide the cards now." },
        ],
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Secondary provider cultural cards failed (${response.status})`,
      );
    }

    const payload: { cards?: Array<Record<string, string>> } =
      await response.json();
    const rawCards = payload.cards;
    if (!rawCards?.length) {
      throw new ServiceUnavailableException("Secondary provider cards empty");
    }

    return rawCards.slice(0, 4).map((card) => ({
      id: randomUUID(),
      title: card.title?.trim() ?? "Culture insight",
      scenario: card.scenario?.trim() ?? "daily",
      expression: card.expression?.trim() ?? "",
      explanation: card.explanation?.trim() ?? "",
      tip: card.tip?.trim() ?? "",
      language: targetLanguage,
    }));
  }

  private buildFallback(language: LanguageCode): CulturePopup[] {
    return [
      {
        id: randomUUID(),
        title: "礼貌开场",
        scenario: "daily",
        expression: "早晨，最近忙紧咩啊？",
        explanation: "粤语常以“早晨”加寒暄句开场，先建立亲切感。",
        tip: "微笑点头，语调上扬，显得亲切自然。",
        language,
      },
      {
        id: randomUUID(),
        title: "点餐称赞",
        scenario: "restaurant",
        expression:
          "The aroma is amazing—could you recommend a local favorite?",
        explanation: "先称赞再提问更礼貌，也更容易获得推荐。",
        tip: "称赞时保持眼神交流，语速放慢。",
        language,
      },
      {
        id: randomUUID(),
        title: "购物客气表达",
        scenario: "shopping",
        expression: "唔好意思，可以再讲慢少少吗？",
        explanation: "买东西听不清时先道歉再提要求，显得尊重。",
        tip: "语调放轻，配合微笑肢体语言。",
        language,
      },
    ];
  }

  private describeLanguage(language: LanguageCode): string {
    switch (language) {
      case LanguageCode.Cantonese:
        return "Cantonese";
      case LanguageCode.Mandarin:
        return "Mandarin Chinese";
      case LanguageCode.English:
        return "English";
      default:
        return language;
    }
  }
}
