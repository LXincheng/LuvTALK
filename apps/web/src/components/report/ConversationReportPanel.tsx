import {
  Activity,
  AudioLines,
  Languages,
  RefreshCw,
  Sparkles,
  Timer,
  TrendingUp,
  Waves,
} from 'lucide-react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useLocale } from '../../providers/LocaleContext';
import type { ConversationReportPayload, LanguageCode } from '../../types/api';
import {
  formatMinutesValue,
  formatRealtimeValue,
  formatScoreValue,
  formatTurnsValue,
} from '../../utils/report-format';

interface ConversationReportPanelProps {
  report: ConversationReportPayload | null;
  isLoading?: boolean;
  onGenerate?: () => void;
  onRefresh?: () => void;
  className?: string;
}

const resolveLanguageLabelKey = (language: LanguageCode) => {
  if (language === 'english') return 'languageEnglish';
  if (language === 'mandarin') return 'languageMandarin';
  return 'languageCantonese';
};

const resolveVoiceLabelKey = (voiceStyle?: string) => {
  if (voiceStyle === 'alloy') return 'voiceAlloy';
  if (voiceStyle === 'nova') return 'voiceNova';
  return 'voiceShimmer';
};

export default function ConversationReportPanel({
  report,
  isLoading = false,
  onGenerate,
  onRefresh,
  className = '',
}: ConversationReportPanelProps) {
  const { t, locale } = useLocale();

  const formattedTime = useMemo(() => {
    if (!report?.updatedAt) return '';
    const date = new Date(report.updatedAt);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }, [locale, report?.updatedAt]);

  if (!report && !isLoading) {
    return (
      <div className={`flex flex-col items-start gap-3 py-1 ${className}`}>
        <div className="space-y-1.5">
          <ReportBadge label={t('reportBadge')} />
          <h3 className="text-lg font-semibold tracking-tight text-label">
            {t('reportTitle')}
          </h3>
          <p className="max-w-2xl text-sm leading-5 text-label-secondary">
            {t('reportEmpty')}
          </p>
        </div>
        {onGenerate ? (
          <button
            type="button"
            onClick={onGenerate}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-white shadow transition hover:opacity-90 active:scale-[0.98]"
          >
            <Sparkles className="h-4 w-4" />
            {t('reportGenerate')}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <section className="rounded-2xl border border-separator bg-surface-elevated/92 p-3.5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <ReportBadge label={t('reportBadge')} />
            <h3 className="text-[16px] font-semibold tracking-tight text-label break-words">
              {report?.report.headline ?? t('reportTitle')}
            </h3>
            {(report?.report.overallSummary || isLoading) ? (
              <p className="max-w-2xl text-[13px] leading-5 text-label-secondary">
                {isLoading && !report ? t('reportGenerating') : report?.report.overallSummary}
              </p>
            ) : null}
          </div>

          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-separator bg-fill px-3 py-1.5 text-[11px] text-label-secondary transition hover:bg-fill-secondary disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              {t('reportRefresh')}
            </button>
          ) : null}
        </div>

        {report ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <MetaPill
              icon={<Languages className="h-3 w-3" />}
              label={t(resolveLanguageLabelKey(report.targetLanguage))}
            />
            <MetaPill
              icon={<AudioLines className="h-3 w-3" />}
              label={report.voiceStyle ? t(resolveVoiceLabelKey(report.voiceStyle)) : t('reportVoiceAuto')}
            />
            {formattedTime ? (
              <MetaPill icon={<Timer className="h-3 w-3" />} label={formattedTime} />
            ) : null}
          </div>
        ) : null}
      </section>

      {report ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label={t('reportMetricAverage')}
            value={formatScoreValue(t, report.metrics.averageScore, 'reportAverage')}
          />
          <MetricCard
            icon={<Activity className="h-3.5 w-3.5" />}
            label={t('reportMetricTurns')}
            value={formatTurnsValue(t, `${report.metrics.userTurns}/${report.metrics.aiTurns}`, 'report')}
          />
          <MetricCard
            icon={<Timer className="h-3.5 w-3.5" />}
            label={t('reportMetricMinutes')}
            value={formatMinutesValue(t, report.metrics.durationMinutes, 'report')}
          />
          <MetricCard
            icon={<Waves className="h-3.5 w-3.5" />}
            label={t('reportMetricRealtime')}
            value={formatRealtimeValue(t, report.metrics.realtimeTurns)}
          />
        </div>
      ) : null}

      {report ? (
        <>
          <section className="grid gap-2.5">
            <CompactCard title={t('reportSnapshot')}>
              <p className="text-[13px] leading-5 text-label-secondary">
                {report.report.learnerSnapshot}
              </p>
            </CompactCard>
          </section>

          <div className="grid gap-2.5 lg:grid-cols-2">
            <PointGroup title={t('reportStrengths')} items={report.report.strengths} tone="good" />
            <PointGroup title={t('reportOpportunities')} items={report.report.opportunities} tone="warn" />
          </div>

          <div className="grid gap-2.5 lg:grid-cols-2">
            <SectionCard title={t('reportPronunciation')} section={report.report.pronunciation} />
            <SectionCard title={t('reportVocabulary')} section={report.report.vocabulary} />
            <SectionCard title={t('reportGrammar')} section={report.report.grammar} />
            <SectionCard title={t('reportRhythm')} section={report.report.rhythm} />
          </div>

          {report.report.keyMoments.length > 0 ? (
            <CompactCard title={t('reportKeyMoments')}>
              <div className="grid gap-2">
                {report.report.keyMoments.map((moment) => (
                  <div
                    key={`${moment.speaker}-${moment.quote}`}
                    className="rounded-xl border border-separator bg-fill px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] text-label-secondary">
                        {moment.speaker === 'user' ? t('reportSpeakerLearner') : t('reportSpeakerTutor')}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-5 text-label break-words">
                      {moment.quote}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-label-secondary break-words">
                      {moment.note}
                    </p>
                  </div>
                ))}
              </div>
            </CompactCard>
          ) : null}
        </>
      ) : (
        <p className="py-2 text-sm text-label-secondary">{t('reportGenerating')}</p>
      )}
    </div>
  );
}

function ReportBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-[var(--color-primary-soft)] px-2.5 py-1 text-[10px] text-label-secondary">
      <Sparkles className="h-3 w-3 text-primary" />
      {label}
    </span>
  );
}

function MetaPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-separator bg-fill px-2.5 py-1 text-[10px] leading-none text-label-secondary">
      {icon}
      <span className="break-words">{label}</span>
    </span>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-separator bg-surface-elevated px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-1 text-[10px] leading-none text-label-tertiary">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 text-[15px] font-semibold tracking-tight text-label">
        {value}
      </div>
    </div>
  );
}

function PointGroup({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'good' | 'warn';
}) {
  const cls =
    tone === 'good'
      ? 'border-emerald-500/20 bg-emerald-500/8 dark:bg-emerald-500/12'
      : 'border-amber-500/20 bg-amber-500/8 dark:bg-amber-500/12';

  return (
    <div className={`rounded-2xl border p-3.5 shadow-sm ${cls}`}>
      <p className="text-sm font-semibold text-label">{title}</p>
      <div className="mt-2.5 space-y-1.5">
        {items.map((item) => (
          <div key={item} className="rounded-xl bg-surface-elevated/90 px-3 py-2 text-[13px] leading-5 text-label-secondary">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  section,
}: {
  title: string;
  section: ConversationReportPayload['report']['pronunciation'];
}) {
  const { t } = useLocale();

  return (
    <div className="rounded-2xl border border-separator bg-surface-elevated p-3.5 shadow-sm">
      <p className="text-sm font-semibold text-label">{title}</p>
      <p className="mt-1.5 text-[13px] leading-5 text-label-secondary">{section.summary}</p>

      {section.highlights.length > 0 ? (
        <div className="mt-2.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-label-tertiary">{t('reportHighlights')}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {section.highlights.map((item) => (
              <span key={item} className="rounded-full border border-separator bg-fill px-2.5 py-1 text-[10px] text-label-secondary">
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {section.actionPlan.length > 0 ? (
        <div className="mt-2.5 space-y-1.5">
          {section.actionPlan.map((item) => (
            <div key={item} className="rounded-xl border border-separator bg-fill px-3 py-2 text-xs leading-5 text-label-secondary">
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CompactCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-separator bg-surface-elevated p-3.5 shadow-sm">
      <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-label-tertiary">
        {title}
      </p>
      {children}
    </section>
  );
}
