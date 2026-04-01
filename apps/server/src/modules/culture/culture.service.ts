import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { envConfig } from "../../common/config/env.config";
import {
  applyThinkingToggle,
  resolveChatModelRoute,
  supportsJsonObjectResponse,
} from "../../common/config/model-provider.config";
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
        `Culture cards fallback: ${(error as Error).message}`,
      );
      return this.buildFallback(params.targetLanguage);
    }
  }

  private async requestCultureCards(
    targetLanguage: LanguageCode,
    nativeLanguage: LanguageCode,
  ): Promise<CulturePopup[]> {
    const prompt = buildCulturePrompt({
      targetLanguage,
      nativeLanguage,
    });
    const modelCandidates = [
      envConfig.modelRouting.secondaryModel,
      envConfig.modelRouting.thirdModel,
    ]
      .map((item) => item.trim())
      .filter(Boolean);

    for (const model of modelCandidates) {
      const route = resolveChatModelRoute(model);
      if (!route) {
        continue;
      }

      const body: Record<string, unknown> = {
        model: route.model,
        temperature: 0.4,
        stream: false,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Provide the cards now." },
        ],
      };
      applyThinkingToggle(body, route.model, false);
      if (supportsJsonObjectResponse(route.model)) {
        body.response_format = { type: "json_object" };
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
          `Culture cards request failed (${response.status}) for model ${route.model}`,
        );
        continue;
      }

      const payload = (await response.json()) as {
        cards?: Array<Record<string, string>>;
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
      const rawCards =
        payload.cards ??
        this.extractCardsFromContent(payload.choices?.[0]?.message?.content);
      if (!rawCards?.length) {
        continue;
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

    throw new ServiceUnavailableException("All cultural card providers failed");
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

  private extractCardsFromContent(
    content:
      | string
      | Array<
          | { type?: string; text?: string }
          | { type?: string; input_text?: string }
        >
      | undefined,
  ): Array<Record<string, string>> {
    const normalized =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content
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
          : "";
    if (!normalized.trim()) {
      return [];
    }
    try {
      const parsed = JSON.parse(normalized) as {
        cards?: Array<Record<string, string>>;
      };
      return parsed.cards ?? [];
    } catch {
      return [];
    }
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
