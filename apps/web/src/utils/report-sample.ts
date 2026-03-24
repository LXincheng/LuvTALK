import type { LocaleKey } from '../providers/LocaleContext';
import type {
  ConversationReportHistoryItem,
  ConversationReportPayload,
} from '../types/api';
import {
  IMMERSIVE_MOCK_REPORT,
  IMMERSIVE_MOCK_REPORT_EN,
} from './report-mock';

type Translator = (key: LocaleKey) => string;

export const createSampleConversationReport = (
  t: Translator,
): ConversationReportPayload => {
  const isEn = t('languageEnglish') === 'English';
  return isEn ? IMMERSIVE_MOCK_REPORT_EN : IMMERSIVE_MOCK_REPORT;
};

export const toSampleHistoryItem = (
  report: ConversationReportPayload,
): ConversationReportHistoryItem => ({
  id: report.id,
  conversationId: report.conversationId,
  createdAt: report.createdAt,
  updatedAt: report.updatedAt,
  targetLanguage: report.targetLanguage,
  nativeLanguage: report.nativeLanguage,
  sourceMode: report.sourceMode,
  voiceStyle: report.voiceStyle,
  reportLanguage: report.reportLanguage,
  headline: report.report.headline,
  overallSummary: report.report.overallSummary,
  averageScore: report.metrics.averageScore,
  durationMinutes: report.metrics.durationMinutes,
});
