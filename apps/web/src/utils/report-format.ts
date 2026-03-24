import type { Locale, LocaleKey } from '../providers/LocaleContext';
import type { ConversationReportHistoryItem } from '../types/api';

type Translator = (key: LocaleKey) => string;

const replaceValue = (template: string, value: string) =>
  template.replace('{value}', value);

export const formatScoreValue = (
  t: Translator,
  value: number | null | undefined,
  variant: 'summaryAverage' | 'summaryLatest' | 'reportAverage' | 'reportScore',
) => {
  if (value === null || value === undefined) {
    return '--';
  }

  const key =
    variant === 'summaryAverage'
      ? 'sessionSummaryAverageValue'
      : variant === 'summaryLatest'
        ? 'sessionSummaryLatestValue'
        : variant === 'reportAverage'
          ? 'reportMetricAverageValue'
          : 'profileReportCardScore';

  return replaceValue(t(key), String(value));
};

export const formatMinutesValue = (
  t: Translator,
  value: number | null | undefined,
  variant: 'summary' | 'report' | 'profile',
) => {
  if (value === null || value === undefined) {
    return '--';
  }

  const key =
    variant === 'summary'
      ? 'sessionSummaryMinutesValue'
      : variant === 'report'
        ? 'reportMetricMinutesValue'
        : 'profileReportCardMinutes';

  return replaceValue(t(key), String(value));
};

export const formatTurnsValue = (
  t: Translator,
  value: string,
  variant: 'summary' | 'report',
) =>
  replaceValue(
    t(variant === 'summary' ? 'sessionSummaryTurnsValue' : 'reportMetricTurnsValue'),
    value,
  );

export const formatRealtimeValue = (t: Translator, value: number) =>
  replaceValue(t('reportMetricRealtimeValue'), String(value));

export const formatReportCount = (t: Translator, value: number) =>
  replaceValue(t('profileReportsCountValue'), String(value));

export const formatReportTimestamp = (
  locale: Locale,
  t: Translator,
  value: string,
) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return t('profileGoalNotSet');
  }

  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const getReportModeLabelKey = (
  mode: ConversationReportHistoryItem['sourceMode'],
): LocaleKey => {
  if (mode === 'text') {
    return 'chatModeText';
  }
  if (mode === 'voice') {
    return 'chatModeVoice';
  }
  return 'chatModeImmersive';
};
