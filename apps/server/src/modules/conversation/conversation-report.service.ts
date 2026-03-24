import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { envConfig } from "../../common/config/env.config";
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
import {
  buildSessionSummary,
  SessionSummaryPayload,
} from "./conversation-summary.types";

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

@Injectable()
export class ConversationReportService {
  private readonly logger = new Logger(ConversationReportService.name);
  private readonly openAiEndpoint = this.resolveOpenAiEndpoint();

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
      (await this.requestOpenAiReport(promptInput)) ??
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
    const aiMessages = session.messages.filter((message) => message.sender === "ai");

    return {
      sourceMode,
      voiceStyle,
      summary,
      targetLanguage: session.targetLanguage,
      nativeLanguage: session.nativeLanguage ?? LanguageCode.Mandarin,
      reportLanguage,
      transcriptLines: session.messages
        .slice(-18)
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

  private async requestOpenAiReport(
    input: ConversationReportPromptInput,
  ): Promise<ConversationReportBody | null> {
    const { apiKey } = envConfig.openai;
    const model = envConfig.modelRouting.primaryModel;
    if (!apiKey || !model || !this.openAiEndpoint) {
      this.logger.warn("Conversation report skipped: primary model config missing.");
      return null;
    }

    const payload = {
      model,
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content: this.buildReportSystemPrompt(input.reportLanguage),
        },
        {
          role: "user",
          content: this.buildReportUserPrompt(input),
        },
      ],
    };

    try {
      const response = await fetch(this.openAiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const detail = await response.text();
        this.logger.warn(
          `Conversation report request failed (${response.status}): ${detail}`,
        );
        return null;
      }

      const raw = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = raw.choices?.[0]?.message?.content;
      if (!content?.trim()) {
        this.logger.warn("Conversation report request returned empty content.");
        return null;
      }

      return this.parseReportContent(content);
    } catch (error) {
      this.logger.warn(
        `Conversation report request aborted: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private buildReportSystemPrompt(reportLanguage: "zh" | "en"): string {
    const outputLanguage =
      reportLanguage === "zh" ? "Simplified Chinese" : "English";
    return [
      "You are a premium 1-on-1 language coaching analyst.",
      `Write the report in ${outputLanguage}.`,
      "Use only evidence that exists in the provided transcript, score trends, and coaching tips.",
      "If direct acoustic evidence is limited, say the pronunciation or rhythm judgment is based on in-session system coaching tips.",
      "Anchor pronunciation, rhythm, and pacing feedback to the tutor system voice when it is provided.",
      "Be specific, practical, premium, and non-generic.",
      "Prefer concise, high-signal language and clear action items over long explanations.",
      "Return ONLY one valid JSON object.",
      "JSON shape:",
      "{",
      '  "headline": "string",',
      '  "overallSummary": "string",',
      '  "learnerSnapshot": "string",',
      '  "strengths": ["string"],',
      '  "opportunities": ["string"],',
      '  "pronunciation": { "summary": "string", "highlights": ["string"], "actionPlan": ["string"] },',
      '  "vocabulary": { "summary": "string", "highlights": ["string"], "actionPlan": ["string"] },',
      '  "grammar": { "summary": "string", "highlights": ["string"], "actionPlan": ["string"] },',
      '  "rhythm": { "summary": "string", "highlights": ["string"], "actionPlan": ["string"] },',
      '  "nextSessionPlan": { "focus": "string", "drills": ["string"], "checkpoint": "string" },',
      '  "keyMoments": [{ "speaker": "user" | "ai", "quote": "string", "note": "string" }]',
      "}",
      "Keep arrays concise: strengths/opportunities/highlights/actionPlan/drills max 3 items; keyMoments max 3 items.",
      "Do not use markdown.",
    ].join("\n");
  }

  private buildReportUserPrompt(input: ConversationReportPromptInput): string {
    const sourceModeLabel =
      input.sourceMode === "immersive"
        ? "immersive realtime voice session"
        : input.sourceMode === "voice"
          ? "voice tutoring session"
          : "text tutoring session";
    return [
      `Target language: ${input.targetLanguage}`,
      `Learner native language: ${input.nativeLanguage}`,
      `Output language: ${input.reportLanguage === "zh" ? "zh" : "en"}`,
      `Session type: ${sourceModeLabel}`,
      `Tutor system voice: ${input.voiceStyle ?? "not provided"}`,
      "If a tutor system voice is provided, align pacing and delivery feedback to that voice style.",
      "Session metrics:",
      JSON.stringify(input.summary, null, 2),
      "Pronunciation tips:",
      JSON.stringify(input.pronunciationTips, null, 2),
      "Grammar tips:",
      JSON.stringify(input.grammarTips, null, 2),
      "Rhythm tips:",
      JSON.stringify(input.rhythmTips, null, 2),
      "Score reasons:",
      JSON.stringify(input.scoreReasons, null, 2),
      "Transcript excerpts:",
      input.transcriptLines.join("\n"),
      "Write a polished premium review report with clear coaching suggestions.",
    ].join("\n\n");
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

  private resolveOpenAiEndpoint(): string | null {
    const raw = envConfig.openai.apiUrl?.replace(/\/$/, "");
    if (!raw) {
      return null;
    }
    if (raw.endsWith("/chat/completions")) {
      return raw;
    }
    if (raw.endsWith("/v1")) {
      return `${raw}/chat/completions`;
    }
    return `${raw}/v1/chat/completions`;
  }

  private isDatabaseConnectionError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P1001" || error.code === "P1002")
    );
  }

  private isConversationReportTableMissingError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2021" &&
      error.meta?.modelName === "ConversationReport"
    );
  }
}
