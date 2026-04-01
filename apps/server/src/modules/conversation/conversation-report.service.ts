import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { envConfig } from "../../common/config/env.config";
import {
  applyThinkingToggle,
  resolveChatModelRoute,
  supportsJsonObjectResponse,
  supportsThinkingToggle,
} from "../../common/config/model-provider.config";
import {
  resolveScenarioLabel,
  resolveScenarioPromptDefinition,
} from "../../common/config/prompts/scenario.config";
import { LanguageCode } from "../../common/enums/language-code.enum";
import {
  ConversationMessage,
  ConversationSession,
} from "../../common/types/conversation.types";
import { PrismaService } from "../../core/prisma/prisma.service";
import { ConversationService } from "./conversation.service";
import {
  ConversationReportBody,
  ConversationReportBodySchema,
  ConversationReportHistoryItem,
  ConversationReportMetrics,
  ConversationReportMetricSchema,
  ConversationReportPayload,
  ConversationReportPromptInput,
  ConversationReportSourceMode,
} from "./conversation-report.types";
import { GenerateConversationReportDto } from "./dto/generate-conversation-report.dto";
import { GenerateScenarioFeedbackDto } from "./dto/generate-scenario-feedback.dto";
import {
  buildSessionSummary,
  SessionSummaryPayload,
} from "./conversation-summary.types";
import { ScenarioFeedbackPayload } from "./conversation-scenario-feedback.types";
import {
  buildConversationReportSystemPrompt,
  buildConversationReportUserPrompt,
  buildScenarioFeedbackSystemPrompt,
  buildScenarioFeedbackUserPrompt,
} from "./conversation-report.prompts";

type ReportRecord = {
  id: string;
  conversationId: string;
  userId: string | null;
  targetLanguage: string;
  nativeLanguage: string | null;
  voiceStyle: string | null;
  sourceMode: string;
  reportLanguage: string;
  report: Prisma.JsonValue;
  metrics: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

type ScenarioFeedbackPromptInput = {
  conversationId: string;
  scenarioId: string;
  scenarioLabel: string;
  scenarioGoals: string[];
  completionSignals: string[];
  reportFocus: string[];
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  reportLanguage: "zh" | "en";
  userTurns: number;
  aiTurns: number;
  averageScore: number | null;
  latestScore: number | null;
  targetLanguageUserTurns: number;
  nativeLanguageUserTurns: number;
  mixedLanguageUserTurns: number;
  pronunciationMentions: number;
  grammarMentions: number;
  rhythmMentions: number;
  strengths: string[];
  improvements: string[];
  transcriptLines: string[];
};

@Injectable()
export class ConversationReportService {
  private readonly logger = new Logger(ConversationReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationService: ConversationService,
  ) {}

  async getLatestReport(
    conversationId: string,
    userId?: string,
    conversationKey?: string,
  ): Promise<ConversationReportPayload | null> {
    await this.conversationService.getAccessibleSession(conversationId, {
      userId,
      conversationKey,
      allowBootstrapMissingAccessKey: true,
      bindUserIfAuthenticated: true,
    });

    const record = await this.findReportByConversationId(conversationId);
    return record ? this.mapReportRecord(record) : null;
  }

  async getUserReportById(
    reportId: string,
    userId: string,
  ): Promise<ConversationReportPayload> {
    if (!this.prisma.canUseDatabase()) {
      this.prisma.ensurePersistentStorageAvailable();
    }

    try {
      const record = await this.prisma.conversationReport.findFirst({
        where: {
          id: reportId,
          userId,
        },
      });
      if (!record) {
        throw new NotFoundException("Conversation report not found");
      }
      return this.mapReportRecord(record);
    } catch (error) {
      if (this.isConversationReportTableMissingError(error)) {
        throw new NotFoundException("Conversation report not found");
      }
      if (this.isDatabaseConnectionError(error)) {
        this.prisma.markDatabaseUnavailable(
          "Database connection lost while reading conversation report.",
        );
      }
      throw error;
    }
  }

  async listUserReports(
    userId: string,
    limit = 10,
  ): Promise<ConversationReportHistoryItem[]> {
    if (!this.prisma.canUseDatabase()) {
      return [];
    }

    try {
      const records = await this.prisma.conversationReport.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: Math.max(1, Math.min(limit, 10)),
      });
      return records.map((record) => this.mapReportHistoryItem(record));
    } catch (error) {
      if (this.isConversationReportTableMissingError(error)) {
        this.logger.warn(
          "Conversation report history skipped: ConversationReport table is missing.",
        );
        return [];
      }
      if (this.isDatabaseConnectionError(error)) {
        this.prisma.markDatabaseUnavailable(
          "Database connection lost while listing conversation reports.",
        );
        return [];
      }
      throw error;
    }
  }

  async generateReport(
    conversationId: string,
    dto: GenerateConversationReportDto,
    userId?: string,
    conversationKey?: string,
  ): Promise<ConversationReportPayload> {
    const session = await this.conversationService.getAccessibleSession(
      conversationId,
      {
        userId,
        conversationKey,
        allowBootstrapMissingAccessKey: true,
        bindUserIfAuthenticated: true,
      },
    );

    const existing = await this.findReportByConversationId(conversationId);
    if (
      existing &&
      !dto.force &&
      existing.updatedAt.getTime() >= new Date(session.updatedAt).getTime()
    ) {
      return this.mapReportRecord(existing);
    }

    const summary = buildSessionSummary({
      conversationId: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages,
    });
    const metrics = this.buildReportMetrics(session.messages, summary);
    const reportLanguage = this.resolveReportLanguage(
      session.nativeLanguage ?? LanguageCode.Mandarin,
    );
    const sourceMode = dto.sourceMode ?? this.resolveSourceMode(session);
    const promptInput = this.buildPromptInput({
      session,
      summary,
      sourceMode,
      voiceStyle: dto.voiceStyle?.trim() || undefined,
      metrics,
      reportLanguage,
    });

    const generatedReport =
      (await this.requestReportWithModel(
        promptInput,
        envConfig.modelRouting.primaryModel,
        envConfig.modelTimeoutMs.primary,
        {
          label: "report-primary",
        },
      )) ??
      (await this.requestReportWithModel(
        promptInput,
        envConfig.modelRouting.secondaryModel,
        envConfig.modelTimeoutMs.secondary,
        {
          label: "report-secondary",
        },
      )) ??
      (await this.requestReportWithModel(
        promptInput,
        envConfig.modelRouting.thirdModel,
        envConfig.modelTimeoutMs.third,
        {
          label: "report-third",
        },
      )) ??
      this.buildFallbackReport(promptInput);

    if (!this.prisma.canUseDatabase()) {
      return {
        id: `report-${conversationId}`,
        conversationId,
        userId: session.userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        targetLanguage: session.targetLanguage,
        nativeLanguage: (session.nativeLanguage ?? null) as LanguageCode | null,
        sourceMode,
        voiceStyle: dto.voiceStyle?.trim() || undefined,
        reportLanguage,
        metrics,
        report: generatedReport,
      };
    }

    try {
      const record = await this.prisma.conversationReport.upsert({
        where: { conversationId },
        update: {
          userId: session.userId,
          targetLanguage: session.targetLanguage,
          nativeLanguage: session.nativeLanguage ?? null,
          voiceStyle: dto.voiceStyle?.trim() || null,
          sourceMode,
          reportLanguage,
          metrics: metrics as unknown as Prisma.InputJsonValue,
          report: generatedReport as unknown as Prisma.InputJsonValue,
        },
        create: {
          conversationId,
          userId: session.userId,
          targetLanguage: session.targetLanguage,
          nativeLanguage: session.nativeLanguage ?? null,
          voiceStyle: dto.voiceStyle?.trim() || null,
          sourceMode,
          reportLanguage,
          metrics: metrics as unknown as Prisma.InputJsonValue,
          report: generatedReport as unknown as Prisma.InputJsonValue,
        },
      });

      return this.mapReportRecord(record);
    } catch (error) {
      if (this.isConversationReportTableMissingError(error)) {
        this.logger.warn(
          "Conversation report table missing while saving report. Returning transient payload.",
        );
        return {
          id: `report-${conversationId}`,
          conversationId,
          userId: session.userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          targetLanguage: session.targetLanguage,
          nativeLanguage: (session.nativeLanguage ?? null) as LanguageCode | null,
          sourceMode,
          voiceStyle: dto.voiceStyle?.trim() || undefined,
          reportLanguage,
          metrics,
          report: generatedReport,
        };
      }
      if (this.isDatabaseConnectionError(error)) {
        this.prisma.markDatabaseUnavailable(
          "Database connection lost while saving conversation report.",
        );
        return {
          id: `report-${conversationId}`,
          conversationId,
          userId: session.userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          targetLanguage: session.targetLanguage,
          nativeLanguage: (session.nativeLanguage ?? null) as LanguageCode | null,
          sourceMode,
          voiceStyle: dto.voiceStyle?.trim() || undefined,
          reportLanguage,
          metrics,
          report: generatedReport,
        };
      }
      throw error;
    }
  }

  async generateScenarioFeedback(
    conversationId: string,
    dto: GenerateScenarioFeedbackDto,
    userId?: string,
    conversationKey?: string,
  ): Promise<ScenarioFeedbackPayload> {
    const session = await this.conversationService.getAccessibleSession(
      conversationId,
      {
        userId,
        conversationKey,
        allowBootstrapMissingAccessKey: true,
        bindUserIfAuthenticated: true,
      },
    );

    const existing = await this.findReportByConversationId(conversationId);
    if (
      existing &&
      !dto.force &&
      existing.updatedAt.getTime() >= new Date(session.updatedAt).getTime()
    ) {
      return this.toScenarioFeedback(this.mapReportRecord(existing));
    }

    const summary = buildSessionSummary({
      conversationId: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages,
    });
    const metrics = this.buildReportMetrics(session.messages, summary);
    const reportLanguage = this.resolveReportLanguage(
      session.nativeLanguage ?? LanguageCode.Mandarin,
    );
    const fastInput = this.buildScenarioFeedbackPromptInput({
      session,
      summary,
      metrics,
      reportLanguage,
    });

    if (fastInput.userTurns <= 0) {
      return this.buildMinimalScenarioFeedback(fastInput);
    }

    return (
      (await this.requestScenarioFeedbackWithModel(
        fastInput,
        envConfig.modelRouting.secondaryModel,
        Math.min(envConfig.modelTimeoutMs.secondary, 7000),
        { label: "scenario-secondary" },
      )) ??
      (await this.requestScenarioFeedbackWithModel(
        fastInput,
        envConfig.modelRouting.primaryModel,
        Math.min(envConfig.modelTimeoutMs.primary, 9000),
        { label: "scenario-primary" },
      )) ??
      (await this.requestScenarioFeedbackWithModel(
        fastInput,
        envConfig.modelRouting.thirdModel,
        Math.min(envConfig.modelTimeoutMs.third, 5000),
        { label: "scenario-third" },
      )) ??
      this.buildFallbackScenarioFeedback(fastInput)
    );
  }

  private async findReportByConversationId(
    conversationId: string,
  ): Promise<ReportRecord | null> {
    if (!this.prisma.canUseDatabase()) {
      return null;
    }

    try {
      return await this.prisma.conversationReport.findUnique({
        where: { conversationId },
      });
    } catch (error) {
      if (this.isConversationReportTableMissingError(error)) {
        this.logger.warn(
          "Conversation report lookup skipped: ConversationReport table is missing.",
        );
        return null;
      }
      if (this.isDatabaseConnectionError(error)) {
        this.prisma.markDatabaseUnavailable(
          "Database connection lost while querying conversation report.",
        );
        return null;
      }
      throw error;
    }
  }

  private buildPromptInput(params: {
    session: ConversationSession;
    summary: SessionSummaryPayload;
    sourceMode: ConversationReportSourceMode;
    voiceStyle?: string;
    metrics: ConversationReportMetrics;
    reportLanguage: "zh" | "en";
  }): ConversationReportPromptInput {
    const { session, summary, sourceMode, voiceStyle, metrics, reportLanguage } =
      params;
    const scenarioDefinition = resolveScenarioPromptDefinition(session.scenarioId);
    const aiMessages = session.messages.filter((message) => message.sender === "ai");
    const languageUsage = this.buildUserLanguageUsage(session);

    return {
      sourceMode,
      voiceStyle,
      summary,
      scenarioId: session.scenarioId,
      scenarioLabel: resolveScenarioLabel(
        session.scenarioId,
        session.nativeLanguage ?? LanguageCode.Mandarin,
      ),
      scenarioGoals: scenarioDefinition.taskGoals,
      completionSignals: scenarioDefinition.completionSignals,
      reportFocus: scenarioDefinition.reportFocus,
      targetLanguage: session.targetLanguage,
      nativeLanguage: session.nativeLanguage ?? LanguageCode.Mandarin,
      reportLanguage,
      targetLanguageUserTurns: languageUsage.targetLanguageTurns,
      nativeLanguageUserTurns: languageUsage.nativeLanguageTurns,
      mixedLanguageUserTurns: languageUsage.mixedLanguageTurns,
      transcriptLines: session.messages
        .map((message) => {
          const speaker = message.sender === "user" ? "Learner" : "Tutor";
          const metaNotes = [
            message.meta?.score !== undefined
              ? `score=${message.meta.score}`
              : undefined,
            message.meta?.pronunciationTip
              ? `pronunciation=${message.meta.pronunciationTip}`
              : undefined,
            message.meta?.rhythmTip ? `rhythm=${message.meta.rhythmTip}` : undefined,
            message.meta?.grammarTip ? `grammar=${message.meta.grammarTip}` : undefined,
            message.meta?.source ? `source=${message.meta.source}` : undefined,
          ]
            .filter((item): item is string => Boolean(item))
            .join("; ");
          return metaNotes
            ? `[${speaker}] ${message.text} | ${metaNotes}`
            : `[${speaker}] ${message.text}`;
        }),
      pronunciationTips: this.dedupeStrings(
        aiMessages
          .map((message) => message.meta?.pronunciationTip)
          .filter((item): item is string => Boolean(item)),
      ).slice(0, 6),
      grammarTips: this.dedupeStrings(
        aiMessages
          .map((message) => message.meta?.grammarTip)
          .filter((item): item is string => Boolean(item)),
      ).slice(0, 6),
      rhythmTips: this.dedupeStrings(
        aiMessages
          .map((message) => message.meta?.rhythmTip)
          .filter((item): item is string => Boolean(item)),
      ).slice(0, 6),
      scoreReasons: this.dedupeStrings(
        aiMessages
          .map((message) => message.meta?.scoreReason)
          .filter((item): item is string => Boolean(item)),
      ).slice(0, 6),
    };
  }

  private buildReportMetrics(
    messages: ConversationMessage[],
    summary: SessionSummaryPayload,
  ): ConversationReportMetrics {
    const aiMessages = messages.filter((message) => message.sender === "ai");
    const realtimeTurns = messages.filter(
      (message) => message.meta?.source === "realtime",
    ).length;

    return ConversationReportMetricSchema.parse({
      durationMinutes: summary.durationMinutes,
      userTurns: summary.userTurns,
      aiTurns: summary.aiTurns,
      averageScore: summary.averageScore,
      latestScore: summary.latestScore,
      pronunciationMentions: aiMessages.filter(
        (message) => typeof message.meta?.pronunciationTip === "string",
      ).length,
      grammarMentions: aiMessages.filter(
        (message) => typeof message.meta?.grammarTip === "string",
      ).length,
      rhythmMentions: aiMessages.filter(
        (message) => typeof message.meta?.rhythmTip === "string",
      ).length,
      realtimeTurns,
    });
  }

  private buildScenarioFeedbackPromptInput(params: {
    session: ConversationSession;
    summary: SessionSummaryPayload;
    metrics: ConversationReportMetrics;
    reportLanguage: "zh" | "en";
  }): ScenarioFeedbackPromptInput {
    const { session, summary, metrics, reportLanguage } = params;
    const scenarioDefinition = resolveScenarioPromptDefinition(session.scenarioId);
    const languageUsage = this.buildUserLanguageUsage(session);
    return {
      conversationId: session.id,
      scenarioId: session.scenarioId,
      scenarioLabel: resolveScenarioLabel(
        session.scenarioId,
        session.nativeLanguage ?? LanguageCode.Mandarin,
      ),
      scenarioGoals: scenarioDefinition.taskGoals,
      completionSignals: scenarioDefinition.completionSignals,
      reportFocus: scenarioDefinition.reportFocus,
      targetLanguage: session.targetLanguage,
      nativeLanguage: session.nativeLanguage ?? LanguageCode.Mandarin,
      reportLanguage,
      userTurns: metrics.userTurns,
      aiTurns: metrics.aiTurns,
      averageScore: metrics.averageScore,
      latestScore: metrics.latestScore,
      targetLanguageUserTurns: languageUsage.targetLanguageTurns,
      nativeLanguageUserTurns: languageUsage.nativeLanguageTurns,
      mixedLanguageUserTurns: languageUsage.mixedLanguageTurns,
      pronunciationMentions: metrics.pronunciationMentions,
      grammarMentions: metrics.grammarMentions,
      rhythmMentions: metrics.rhythmMentions,
      strengths: summary.strengths.slice(0, 3),
      improvements: summary.improvements.slice(0, 3),
      transcriptLines: session.messages
        .map((message) => {
          const speaker = message.sender === "user" ? "Learner" : "Tutor";
          return `[${speaker}] ${message.text}`;
        }),
    };
  }

  private resolveSourceMode(
    session: ConversationSession,
  ): ConversationReportSourceMode {
    const hasRealtime = session.messages.some(
      (message) => message.meta?.source === "realtime",
    );
    if (hasRealtime) {
      return "immersive";
    }
    const hasVoiceSignals = session.messages.some(
      (message) => message.meta?.audioUrl,
    );
    return hasVoiceSignals ? "voice" : "text";
  }

  private resolveReportLanguage(
    nativeLanguage: LanguageCode,
  ): "zh" | "en" {
    return nativeLanguage === LanguageCode.English ? "en" : "zh";
  }

  private async requestReportWithModel(
    input: ConversationReportPromptInput,
    model: string,
    timeoutMs: number,
    options: { label: string; enableThinking?: boolean },
  ): Promise<ConversationReportBody | null> {
    const route = resolveChatModelRoute(model);
    if (!route) {
      return null;
    }
    const useThinking =
      Boolean(options.enableThinking) && supportsThinkingToggle(route.model);
    const useJsonMode =
      !useThinking && supportsJsonObjectResponse(route.model);

    const payload: Record<string, unknown> = {
      model: route.model,
      temperature: useThinking ? 0.2 : 0.3,
      stream: false,
      messages: [
        {
          role: "system",
          content: buildConversationReportSystemPrompt(input.reportLanguage),
        },
        {
          role: "user",
          content: buildConversationReportUserPrompt(input),
        },
      ],
    };
    applyThinkingToggle(payload, route.model, useThinking);
    if (useJsonMode) {
      payload.response_format = { type: "json_object" };
    }

    try {
      const content = await this.fetchChatCompletionContentWithTimeout(
        route.endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${route.apiKey}`,
          },
          body: JSON.stringify(payload),
        },
        timeoutMs,
      );

      if (!content) {
        return null;
      }
      return this.parseReportContent(content);
    } catch (error) {
      this.logger.warn(
        `Conversation report request ${options.label} aborted: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async requestScenarioFeedbackWithModel(
    input: ScenarioFeedbackPromptInput,
    model: string,
    timeoutMs: number,
    options: { label: string },
  ): Promise<ScenarioFeedbackPayload | null> {
    const route = resolveChatModelRoute(model);
    if (!route) {
      return null;
    }

    const payload: Record<string, unknown> = {
      model: route.model,
      temperature: 0.15,
      stream: false,
      messages: [
        {
          role: "system",
          content: buildScenarioFeedbackSystemPrompt(input.reportLanguage),
        },
        {
          role: "user",
          content: buildScenarioFeedbackUserPrompt(input),
        },
      ],
    };
    applyThinkingToggle(payload, route.model, false);
    if (supportsJsonObjectResponse(route.model)) {
      payload.response_format = { type: "json_object" };
    }

    try {
      const content = await this.fetchChatCompletionContentWithTimeout(
        route.endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${route.apiKey}`,
          },
          body: JSON.stringify(payload),
        },
        timeoutMs,
      );

      if (!content) {
        return null;
      }
      return this.parseScenarioFeedbackContent(content, input);
    } catch (error) {
      this.logger.warn(
        `Scenario feedback request ${options.label} aborted: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private parseReportContent(content: string): ConversationReportBody | null {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      const parsed = JSON.parse(content.slice(start, end + 1)) as Record<
        string,
        unknown
      >;
      return ConversationReportBodySchema.parse(
        this.normalizeReportPayload(parsed),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to parse conversation report JSON: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private parseScenarioFeedbackContent(
    content: string,
    input: ScenarioFeedbackPromptInput,
  ): ScenarioFeedbackPayload | null {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      const parsed = JSON.parse(content.slice(start, end + 1)) as Record<
        string,
        unknown
      >;
      return this.normalizeScenarioFeedbackPayload(parsed, input);
    } catch (error) {
      this.logger.warn(
        `Failed to parse scenario feedback JSON: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private buildFallbackReport(
    input: ConversationReportPromptInput,
  ): ConversationReportBody {
    const isZh = input.reportLanguage === "zh";
    const headline = isZh
      ? `${this.resolveLanguageLabel(input.targetLanguage)} 1 对 1 复盘报告`
      : `${this.resolveLanguageLabel(input.targetLanguage)} 1:1 Review Report`;
    const firstStrength =
      input.summary.strengths[0] ??
      (isZh
        ? "本轮保持了基本的持续输出。"
        : "You kept the conversation moving with steady output.");
    const firstImprovement =
      input.summary.improvements[0] ??
      (isZh
        ? "建议优先收紧句子结构并强化关键词重音。"
        : "Tighten sentence structure and reinforce key-word stress first.");
    const firstAction =
      input.summary.recommendedNextActions[0] ??
      (isZh
        ? "下一轮继续复用本轮高频表达。"
        : "Reuse the high-frequency expressions from this session next time.");

    return ConversationReportBodySchema.parse({
      headline,
      overallSummary: isZh
        ? `这是一轮${input.sourceMode === "immersive" ? "沉浸式" : "1 对 1"}练习。整体表现显示你已经能维持基本沟通，但仍有明显的精修空间。`
        : `This was a ${input.sourceMode === "immersive" ? "realtime immersive" : "1:1"} practice session. You already sustain the conversation, but there is still clear room for refinement.`,
      learnerSnapshot: isZh
        ? `本轮共 ${input.summary.userTurns} 次学员输出，系统平均分 ${input.summary.averageScore ?? "--"}。`
        : `You produced ${input.summary.userTurns} learner turns in this session, with an average system score of ${input.summary.averageScore ?? "--"}.`,
      strengths: [firstStrength, ...input.summary.strengths.slice(1, 3)].slice(
        0,
        3,
      ),
      opportunities: [
        firstImprovement,
        ...input.summary.improvements.slice(1, 3),
      ].slice(0, 3),
      pronunciation: {
        summary: isZh
          ? "基于本轮系统发音提示，你需要继续把关键词重音和句尾收音做得更清楚。"
          : "Based on the in-session pronunciation tips, keep sharpening key-word stress and cleaner sentence endings.",
        highlights: input.pronunciationTips.slice(0, 3),
        actionPlan: [
          ...(input.pronunciationTips.slice(0, 2).length
            ? input.pronunciationTips.slice(0, 2)
            : [
                isZh
                  ? "跟读 3 轮，每轮只修一个发音点。"
                  : "Shadow the sentence for 3 rounds and fix one pronunciation point each round.",
              ]),
        ].slice(0, 3),
      },
      vocabulary: {
        summary: isZh
          ? "建议从本轮关键词和场景高频表达中继续扩展可复用句式。"
          : "Expand from the session keywords into reusable, scenario-ready sentence patterns.",
        highlights: input.summary.keyTerms
          .slice(0, 3)
          .map((item) => `${item.term}: ${item.definition}`),
        actionPlan: [
          isZh
            ? "挑 2 个关键词各造一句新句。"
            : "Pick 2 key terms and build one new sentence for each.",
          isZh
            ? "下轮优先复用本轮高频表达。"
            : "Reuse this session's high-frequency expressions next round.",
        ],
      },
      grammar: {
        summary: isZh
          ? "语法层面的核心任务是让每句话只保留一个主结构，减少混搭。"
          : "The main grammar task is to keep each sentence around one clear structure instead of mixing forms.",
        highlights: input.grammarTips.slice(0, 3),
        actionPlan: [
          ...(input.grammarTips.slice(0, 2).length
            ? input.grammarTips.slice(0, 2)
            : [
                isZh
                  ? "把错误句改写 2 次再复说。"
                  : "Rewrite the weak sentence twice before saying it again.",
              ]),
        ].slice(0, 3),
      },
      rhythm: {
        summary: isZh
          ? "节奏上建议按意群停顿，让句子听起来更自然。"
          : "For rhythm, pause by sense groups so the sentence sounds more natural.",
        highlights: input.rhythmTips.slice(0, 3),
        actionPlan: [
          ...(input.rhythmTips.slice(0, 2).length
            ? input.rhythmTips.slice(0, 2)
            : [
                isZh
                  ? "每句先慢速说一遍，再恢复正常语速。"
                  : "Say each sentence once slowly before returning to normal pace.",
              ]),
        ].slice(0, 3),
      },
      nextSessionPlan: {
        focus: firstAction,
        drills: input.summary.recommendedNextActions.slice(0, 3),
        checkpoint: isZh
          ? "如果下轮能稳定输出更短、更准的句子，说明这次复盘已经起效。"
          : "If you can produce shorter and more accurate sentences next round, this review has already worked.",
      },
      keyMoments: input.transcriptLines.slice(-3).map((line, index) => ({
        speaker: line.startsWith("[Tutor]") ? "ai" : "user",
        quote: line.slice(0, 120),
        note:
          index === 0
            ? isZh
              ? "这里体现了本轮的核心表达习惯。"
              : "This captures a core expression habit from the session."
            : isZh
              ? "这里能看出你当前最值得继续打磨的点。"
              : "This shows one of the most valuable points to refine next.",
      })),
    });
  }

  private buildMinimalScenarioFeedback(
    input: ScenarioFeedbackPromptInput,
  ): ScenarioFeedbackPayload {
    const isZh = input.reportLanguage === "zh";
    return {
      conversationId: input.conversationId,
      overallScore: 52,
      headline: isZh ? "这一轮还没真正展开" : "This round barely started",
      summary: isZh
        ? "你还没有完成有效练习。下一轮先完成 2 到 3 轮真实对话，再来看评分会更准确。"
        : "You have not completed enough real practice yet. Try finishing 2 or 3 real turns next time for a more accurate score.",
      dimensions: [
        { key: "taskCompletion", score: 48 },
        { key: "naturalness", score: 56 },
        { key: "pronunciation", score: 54 },
        { key: "resilience", score: 50 },
      ],
      suggestions: isZh
        ? [
            "先把场景里的第一句完整说出来。",
            "至少完成一轮问答，再继续追问一次。",
            "结束前再做一次确认或收尾。",
          ]
        : [
            "Start with one complete first line in the scenario.",
            "Finish at least one full question-and-answer exchange.",
            "Add one confirmation or closing line before ending.",
          ],
    };
  }

  private buildFallbackScenarioFeedback(
    input: ScenarioFeedbackPromptInput,
  ): ScenarioFeedbackPayload {
    if (input.userTurns <= 0) {
      return this.buildMinimalScenarioFeedback(input);
    }

    const baseScore =
      input.userTurns === 1
        ? input.latestScore ?? 61
        : input.averageScore ?? input.latestScore ?? 68;
    const clamp = (value: number, min = 45, max = 96) =>
      Math.max(min, Math.min(max, Math.round(value)));
    const taskCompletion = clamp(
      baseScore * 0.72 +
        Math.min(22, input.userTurns * 5) -
        Math.max(0, 12 - input.aiTurns * 2) +
        Math.min(10, input.targetLanguageUserTurns * 2) -
        Math.min(8, input.nativeLanguageUserTurns * 2),
      input.userTurns <= 1 ? 45 : 58,
    );
    const naturalness = clamp(
      baseScore +
        5 -
        Math.min(18, input.grammarMentions * 3) -
        Math.min(10, input.rhythmMentions * 2) -
        Math.min(8, input.mixedLanguageUserTurns * 2),
    );
    const pronunciation = clamp(
      (input.latestScore ?? baseScore) * 0.8 + 10 - Math.min(18, input.pronunciationMentions * 4),
    );
    const resilience = clamp(
      baseScore * 0.68 + 8 + Math.min(16, Math.max(0, input.userTurns - 2) * 3),
    );
    const overallScore =
      input.userTurns === 1
        ? clamp(baseScore, 58, 72)
        : clamp(
            taskCompletion * 0.34 +
              naturalness * 0.22 +
              pronunciation * 0.24 +
              resilience * 0.2,
            60,
            96,
          );
    const isZh = input.reportLanguage === "zh";

    return {
      conversationId: input.conversationId,
      overallScore,
      headline:
        overallScore >= 88
          ? isZh
            ? "这轮完成得很稳"
            : "A strong, steady round"
          : overallScore >= 72
            ? isZh
              ? "这轮已经有真实练习感"
              : "This already feels like real practice"
            : isZh
              ? "场景感已经有了，还需要再收紧"
              : "The scenario is there, but it still needs tightening",
      summary:
        input.userTurns === 1
          ? isZh
            ? "你已经开始进入场景了，但对话轮次还太少，暂时只能给出保守评分。"
            : "You entered the scenario, but the round was still too short, so the score stays conservative."
          : isZh
            ? "这份评分基于整段场景对话、真实轮次、目标语言使用情况和系统纠错线索生成，重点看你是否把场景真正推进并完成。"
            : "This score is based on the full scenario transcript, real turn flow, target-language usage, and coaching signals, with focus on whether you actually moved the scene forward and completed it.",
      dimensions: [
        { key: "taskCompletion", score: taskCompletion },
        { key: "naturalness", score: naturalness },
        { key: "pronunciation", score: pronunciation },
        { key: "resilience", score: resilience },
      ],
      suggestions: this.dedupeStrings(
        [
          ...input.improvements,
          ...(isZh
            ? [
                "下一轮先回答，再补一个具体细节。",
                "把句子缩短一点，会更自然。",
                "结束前补一次确认或收尾。",
              ]
            : [
                "Answer first, then add one concrete detail.",
                "Shorter sentences will sound more natural.",
                "Add one confirmation or closing line before ending.",
              ]),
        ],
      ).slice(0, 3),
    };
  }

  private mapReportRecord(record: ReportRecord): ConversationReportPayload {
    const report = ConversationReportBodySchema.parse(
      this.normalizeReportPayload(record.report as Record<string, unknown>),
    );
    const metrics = ConversationReportMetricSchema.parse(record.metrics);
    return {
      id: record.id,
      conversationId: record.conversationId,
      userId: record.userId ?? undefined,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      targetLanguage: this.normalizeLanguageCode(record.targetLanguage),
      nativeLanguage: record.nativeLanguage
        ? this.normalizeLanguageCode(record.nativeLanguage)
        : null,
      sourceMode: this.normalizeSourceMode(record.sourceMode),
      voiceStyle: record.voiceStyle ?? undefined,
      reportLanguage: record.reportLanguage === "en" ? "en" : "zh",
      metrics,
      report,
    };
  }

  private toScenarioFeedback(
    report: ConversationReportPayload,
  ): ScenarioFeedbackPayload {
    const userTurns = report.metrics.userTurns;
    const aiTurns = report.metrics.aiTurns;
    const baseScore = (() => {
      if (userTurns <= 0) {
        return 52;
      }
      if (userTurns === 1) {
        return report.metrics.latestScore ?? 61;
      }
      return (
        report.metrics.averageScore ??
        report.metrics.latestScore ??
        68
      );
    })();
    const clamp = (value: number) => Math.max(60, Math.min(99, Math.round(value)));
    const clampLoose = (value: number) => Math.max(45, Math.min(99, Math.round(value)));
    const taskCompletion = (userTurns <= 1 ? clampLoose : clamp)(
      baseScore * 0.7 +
        Math.min(22, userTurns * 5) -
        Math.max(0, 12 - aiTurns * 2),
    );
    const naturalness = clampLoose(
      baseScore +
        6 -
        Math.min(18, report.metrics.grammarMentions * 3) -
        Math.min(10, report.metrics.rhythmMentions * 2),
    );
    const pronunciation = clampLoose(
      (report.metrics.latestScore ?? baseScore) * 0.78 +
        12 -
        Math.min(20, report.metrics.pronunciationMentions * 4),
    );
    const resilience = clampLoose(
      baseScore * 0.68 +
        8 +
        Math.min(16, Math.max(0, userTurns - 2) * 3) -
        Math.min(8, Math.max(0, report.report.opportunities.length - 1) * 2),
    );

    const overallScore = (() => {
      if (userTurns <= 0) {
        return 52;
      }
      if (userTurns === 1) {
        return Math.max(58, Math.min(72, Math.round(baseScore)));
      }
      return Math.max(
        60,
        Math.min(
          96,
          Math.round(
            taskCompletion * 0.34 +
              naturalness * 0.22 +
              pronunciation * 0.24 +
              resilience * 0.2,
          ),
        ),
      );
    })();

    const suggestions = this.dedupeStrings(
      [
        report.report.nextSessionPlan.focus,
        ...report.report.nextSessionPlan.drills,
        ...report.report.opportunities.slice(0, 2),
      ].filter((item): item is string => Boolean(item?.trim())),
    ).slice(0, 3);

    return {
      conversationId: report.conversationId,
      overallScore,
      summary:
        userTurns <= 0
          ? report.reportLanguage === "en"
            ? "This round barely started. Begin with 2 or 3 turns next time so the feedback can reflect your real level."
            : "这一轮几乎还没真正开始。下次至少完成 2 到 3 轮对话，反馈才会更接近你的真实水平。"
          : report.report.overallSummary,
      headline: report.report.headline,
      dimensions: [
        { key: "taskCompletion", score: taskCompletion },
        { key: "naturalness", score: naturalness },
        { key: "pronunciation", score: pronunciation },
        { key: "resilience", score: resilience },
      ],
      suggestions,
    };
  }

  private normalizeScenarioFeedbackPayload(
    value: Record<string, unknown>,
    input: ScenarioFeedbackPromptInput,
  ): ScenarioFeedbackPayload {
    const fallback = this.buildFallbackScenarioFeedback(input);
    const dimensions =
      value.dimensions && typeof value.dimensions === "object"
        ? (value.dimensions as Record<string, unknown>)
        : {};
    const parseScore = (raw: unknown, fallbackValue: number) => {
      const numeric =
        typeof raw === "number"
          ? raw
          : typeof raw === "string"
            ? Number(raw)
            : Number.NaN;
      if (!Number.isFinite(numeric)) {
        return fallbackValue;
      }
      return Math.max(45, Math.min(99, Math.round(numeric)));
    };
    const suggestions = Array.isArray(value.suggestions)
      ? value.suggestions
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter((item) => item.length > 0)
          .slice(0, 3)
      : fallback.suggestions;

    const normalized: ScenarioFeedbackPayload = {
      conversationId: input.conversationId,
      overallScore: parseScore(value.overallScore, fallback.overallScore),
      headline:
        typeof value.headline === "string" && value.headline.trim()
          ? value.headline.trim()
          : fallback.headline,
      summary:
        typeof value.summary === "string" && value.summary.trim()
          ? value.summary.trim()
          : fallback.summary,
      dimensions: [
        {
          key: "taskCompletion",
          score: parseScore(dimensions.taskCompletion, fallback.dimensions[0].score),
        },
        {
          key: "naturalness",
          score: parseScore(dimensions.naturalness, fallback.dimensions[1].score),
        },
        {
          key: "pronunciation",
          score: parseScore(dimensions.pronunciation, fallback.dimensions[2].score),
        },
        {
          key: "resilience",
          score: parseScore(dimensions.resilience, fallback.dimensions[3].score),
        },
      ],
      suggestions: suggestions.length ? suggestions : fallback.suggestions,
    };

    if (input.userTurns <= 1) {
      normalized.overallScore = Math.min(normalized.overallScore, fallback.overallScore);
      normalized.dimensions = normalized.dimensions.map((dimension, index) => ({
        ...dimension,
        score: Math.min(dimension.score, fallback.dimensions[index]?.score ?? dimension.score),
      }));
    }

    return normalized;
  }

  private mapReportHistoryItem(record: ReportRecord): ConversationReportHistoryItem {
    const payload = this.mapReportRecord(record);
    return {
      id: payload.id,
      conversationId: payload.conversationId,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
      targetLanguage: payload.targetLanguage,
      nativeLanguage: payload.nativeLanguage,
      sourceMode: payload.sourceMode,
      voiceStyle: payload.voiceStyle,
      reportLanguage: payload.reportLanguage,
      headline: payload.report.headline,
      overallSummary: payload.report.overallSummary,
      averageScore: payload.metrics.averageScore,
      durationMinutes: payload.metrics.durationMinutes,
    };
  }

  private normalizeLanguageCode(value: string): LanguageCode {
    if (value === LanguageCode.English) {
      return LanguageCode.English;
    }
    if (value === LanguageCode.Cantonese) {
      return LanguageCode.Cantonese;
    }
    return LanguageCode.Mandarin;
  }

  private normalizeSourceMode(value: string): ConversationReportSourceMode {
    if (value === "text" || value === "voice") {
      return value;
    }
    return "immersive";
  }

  private resolveLanguageLabel(language: LanguageCode): string {
    if (language === LanguageCode.Cantonese) {
      return "Cantonese";
    }
    if (language === LanguageCode.English) {
      return "English";
    }
    return "Mandarin";
  }

  private dedupeStrings(items: string[]): string[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const normalized = item.trim();
      if (!normalized || seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
  }

  private normalizeReportPayload(
    value: Record<string, unknown>,
  ): ConversationReportBody {
    const normalizeStringArray = (input: unknown, limit: number): string[] => {
      if (!Array.isArray(input)) {
        return [];
      }
      return input
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0)
        .slice(0, limit);
    };

    const normalizeSection = (input: unknown) => {
      const record =
        input && typeof input === "object"
          ? (input as Record<string, unknown>)
          : {};
      return {
        summary:
          typeof record.summary === "string" && record.summary.trim()
            ? record.summary.trim()
            : "",
        highlights: normalizeStringArray(record.highlights, 3),
        actionPlan: normalizeStringArray(record.actionPlan, 3),
      };
    };

    const payload =
      value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    const nextSessionPlan =
      payload.nextSessionPlan && typeof payload.nextSessionPlan === "object"
        ? (payload.nextSessionPlan as Record<string, unknown>)
        : {};

    return {
      headline:
        typeof payload.headline === "string" ? payload.headline.trim() : "",
      overallSummary:
        typeof payload.overallSummary === "string"
          ? payload.overallSummary.trim()
          : "",
      learnerSnapshot:
        typeof payload.learnerSnapshot === "string"
          ? payload.learnerSnapshot.trim()
          : "",
      strengths: normalizeStringArray(payload.strengths, 3),
      opportunities: normalizeStringArray(payload.opportunities, 3),
      pronunciation: normalizeSection(payload.pronunciation),
      vocabulary: normalizeSection(payload.vocabulary),
      grammar: normalizeSection(payload.grammar),
      rhythm: normalizeSection(payload.rhythm),
      nextSessionPlan: {
        focus:
          typeof nextSessionPlan.focus === "string"
            ? nextSessionPlan.focus.trim()
            : "",
        drills: normalizeStringArray(nextSessionPlan.drills, 3),
        checkpoint:
          typeof nextSessionPlan.checkpoint === "string"
            ? nextSessionPlan.checkpoint.trim()
            : "",
      },
      keyMoments: Array.isArray(payload.keyMoments)
        ? payload.keyMoments
            .map((item) => {
              const record =
                item && typeof item === "object"
                  ? (item as Record<string, unknown>)
                  : {};
              const speaker =
                record.speaker === "ai" || record.speaker === "user"
                  ? record.speaker
                  : "user";
              const quote =
                typeof record.quote === "string" ? record.quote.trim() : "";
              const note =
                typeof record.note === "string" ? record.note.trim() : "";
              if (!quote || !note) {
                return null;
              }
              return { speaker, quote, note };
            })
            .filter(
              (
                item,
              ): item is { speaker: "user" | "ai"; quote: string; note: string } =>
                item !== null,
            )
            .slice(0, 3)
        : [],
    };
  }

  private async fetchChatCompletionContentWithTimeout(
    input: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text();
        this.logger.warn(
          `Chat completion request failed (${response.status}): ${detail}`,
        );
        return null;
      }

      const raw = (await response.json()) as {
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
      const content = this.extractMessageContent(raw.choices?.[0]?.message?.content);
      if (!content?.trim()) {
        this.logger.warn("Chat completion request returned empty content.");
        return null;
      }
      return content;
    } finally {
      clearTimeout(timer);
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
      return content;
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

  private isDatabaseConnectionError(error: unknown): boolean {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P1001" || error.code === "P1002")
    ) {
      return true;
    }
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (
      message.includes("server has closed the connection") ||
      message.includes("connection terminated") ||
      message.includes("connection closed") ||
      message.includes("can't reach database server")
    );
  }

  private buildUserLanguageUsage(session: ConversationSession): {
    targetLanguageTurns: number;
    nativeLanguageTurns: number;
    mixedLanguageTurns: number;
  } {
    let targetLanguageTurns = 0;
    let nativeLanguageTurns = 0;
    let mixedLanguageTurns = 0;

    for (const message of session.messages) {
      if (message.sender !== "user") {
        continue;
      }
      const usage = this.classifyUserTurnLanguage(
        message.text,
        session.targetLanguage,
        session.nativeLanguage ?? LanguageCode.Mandarin,
      );
      if (usage === "target") {
        targetLanguageTurns += 1;
      } else if (usage === "native") {
        nativeLanguageTurns += 1;
      } else if (usage === "mixed") {
        mixedLanguageTurns += 1;
      }
    }

    return {
      targetLanguageTurns,
      nativeLanguageTurns,
      mixedLanguageTurns,
    };
  }

  private classifyUserTurnLanguage(
    text: string,
    targetLanguage: LanguageCode,
    nativeLanguage: LanguageCode,
  ): "target" | "native" | "mixed" | "other" {
    const normalized = text.trim();
    if (!normalized) {
      return "other";
    }
    const hasLatin = /[A-Za-z]/.test(normalized);
    const hasCjk = /[\u3400-\u9fff]/.test(normalized);

    if (hasLatin && hasCjk) {
      return "mixed";
    }

    if (targetLanguage === LanguageCode.English) {
      if (hasLatin) {
        return "target";
      }
      if (hasCjk) {
        return nativeLanguage === LanguageCode.English ? "other" : "native";
      }
      return "other";
    }

    if (hasCjk) {
      return "target";
    }
    if (hasLatin) {
      return nativeLanguage === LanguageCode.English ? "native" : "other";
    }
    return "other";
  }

  private isConversationReportTableMissingError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2021" &&
      error.meta?.modelName === "ConversationReport"
    );
  }
}
