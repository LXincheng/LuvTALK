import {
  Activity,
  AudioLines,
  ChevronDown,
  Languages,
  RefreshCw,
  Sparkles,
  Timer,
  TrendingUp,
  Waves,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
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
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [planOpen, setPlanOpen] = useState(false);

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

  /* ─── Empty state ─── */
  if (!report && !isLoading) {
    return (
      <div className={`flex flex-col items-start gap-4 py-2 ${className}`}>
        <div className="space-y-1.5">
          <ReportBadge label={t('reportBadge')} />
          <h3 className="text-lg font-semibold tracking-tight text-label">{t('reportTitle')}</h3>
          <p className="text-sm leading-5 text-label-secondary">{t('reportEmpty')}</p>
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

  /* ─── Main layout ─── */
  return (
    <div className={`space-y-3 ${className}`}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <ReportBadge label={t('reportBadge')} />
          <h3 className="text-[17px] font-semibold tracking-tight text-label">
            {report?.report.headline ?? t('reportTitle')}
          </h3>
          {(report?.report.overallSummary || isLoading) ? (
            <p className="text-sm leading-5 text-label-secondary">
              {isLoading && !report ? t('reportGenerating') : report?.report.overallSummary}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-full border border-separator bg-fill px-3 py-1.5 text-[11px] text-label-secondary transition hover:bg-fill-secondary disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              {t('reportRefresh')}
            </button>
          ) : null}
          {report ? (
            <div className="flex flex-wrap items-center justify-end gap-1">
              <MetaPill icon={<Languages className="h-3 w-3" />} label={t(resolveLanguageLabelKey(report.targetLanguage))} />
              <MetaPill
                icon={<AudioLines className="h-3 w-3" />}
                label={report.voiceStyle ? t(resolveVoiceLabelKey(report.voiceStyle)) : t('reportVoiceAuto')}
              />
              {formattedTime ? (
                <MetaPill icon={<Timer className="h-3 w-3" />} label={formattedTime} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Metrics 2×2 on mobile, 4×1 on sm+ ── */}
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
          {/* ── Learner snapshot ── */}
          <div className="rounded-xl bg-fill px-3.5 py-3">
            <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-label-tertiary">
              {t('reportSnapshot')}
            </p>
            <p className="text-sm leading-5 text-label-secondary">
              {report.report.learnerSnapshot}
            </p>
          </div>

          {/* ── Section toggles ── */}
          <div className="flex gap-2">
            <ToggleButton label={t('reportAnalysisToggle')} open={analysisOpen} onToggle={() => setAnalysisOpen((v) => !v)} />
            <ToggleButton label={t('reportPlanToggle')} open={planOpen} onToggle={() => setPlanOpen((v) => !v)} />
          </div>

          {/* ── Analysis ── */}
          {analysisOpen ? (
            <div className="space-y-2.5">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <PointGroup title={t('reportStrengths')} items={report.report.strengths} tone="good" />
                <PointGroup title={t('reportOpportunities')} items={report.report.opportunities} tone="warn" />
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <SectionCard title={t('reportPronunciation')} section={report.report.pronunciation} accent="bg-sky-500/10" />
                <SectionCard title={t('reportVocabulary')} section={report.report.vocabulary} accent="bg-emerald-500/10" />
                <SectionCard title={t('reportGrammar')} section={report.report.grammar} accent="bg-fuchsia-500/10" />
                <SectionCard title={t('reportRhythm')} section={report.report.rhythm} accent="bg-amber-500/10" />
              </div>
            </div>
          ) : null}

          {/* ── Next session plan + key moments ── */}
          {planOpen ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-separator bg-fill p-3.5">
                <p className="text-sm font-semibold text-label">{t('reportNextSession')}</p>
                <p className="mt-1.5 text-xs leading-5 text-label-secondary">
                  {report.report.nextSessionPlan.focus}
                </p>
                <div className="mt-2.5 space-y-1.5">
                  {report.report.nextSessionPlan.drills.map((item) => (
                    <div key={item} className="rounded-lg border border-separator bg-surface-elevated px-3 py-1.5 text-xs leading-5 text-label-secondary">
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 rounded-lg border border-primary/25 bg-primary/8 px-3 py-2 text-xs leading-5 text-primary">
                  {report.report.nextSessionPlan.checkpoint}
                </div>
              </div>

              <div className="rounded-xl border border-separator bg-fill p-3.5">
                <p className="text-sm font-semibold text-label">{t('reportKeyMoments')}</p>
                <div className="mt-2.5 space-y-2">
                  {report.report.keyMoments.map((moment) => (
                    <motion.div
                      key={`${moment.speaker}-${moment.quote}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-lg border border-separator bg-surface-elevated p-2.5"
                    >
                      <span className="mb-1.5 inline-flex rounded-full border border-separator bg-fill px-2 py-0.5 text-[10px] text-label-tertiary">
                        {moment.speaker === 'user' ? t('reportSpeakerLearner') : t('reportSpeakerTutor')}
                      </span>
                      <p className="text-xs leading-5 text-label">"{moment.quote}"</p>
                      <p className="mt-1 text-[11px] leading-4 text-label-secondary">{moment.note}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="py-2 text-sm text-label-secondary">{t('reportGenerating')}</p>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function ReportBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-separator bg-fill px-2.5 py-1 text-[11px] text-label-secondary">
      <Sparkles className="h-3 w-3 text-primary" />
      {label}
    </span>
  );
}

function MetaPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-separator bg-fill px-2 py-0.5 text-[10px] text-label-secondary">
      {icon}
      {label}
    </span>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-separator bg-surface-elevated px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-1 text-[10px] text-label-tertiary">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-base font-semibold tracking-tight text-label">
        {value}
      </div>
    </div>
  );
}

function ToggleButton({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1.5 rounded-full border border-separator bg-fill px-3 py-1.5 text-xs text-label-secondary transition hover:bg-fill-secondary"
    >
      {label}
      <ChevronDown className={`h-3 w-3 transition ${open ? 'rotate-180' : ''}`} />
    </button>
  );
}

function PointGroup({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'warn' }) {
  const cls =
    tone === 'good'
      ? 'border-emerald-500/20 bg-emerald-500/8 dark:bg-emerald-500/12'
      : 'border-amber-500/20 bg-amber-500/8 dark:bg-amber-500/12';
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <p className="text-xs font-semibold text-label">{title}</p>
      <div className="mt-2 space-y-1.5">
        {items.map((item) => (
          <div key={item} className="rounded-lg bg-fill px-3 py-2 text-xs leading-5 text-label-secondary">
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
  accent,
}: {
  title: string;
  section: ConversationReportPayload['report']['pronunciation'];
  accent: string;
}) {
  const { t } = useLocale();
  return (
    <div className="rounded-xl border border-separator bg-surface-elevated p-3">
      <div className={`-mx-3 -mt-3 mb-3 h-1.5 rounded-t-xl ${accent}`} />
      <p className="text-xs font-semibold text-label">{title}</p>
      <p className="mt-1.5 text-xs leading-5 text-label-secondary">{section.summary}</p>

      {section.highlights.length > 0 ? (
        <div className="mt-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-label-tertiary">{t('reportHighlights')}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {section.highlights.map((item) => (
              <span key={item} className="rounded-full border border-separator bg-fill px-2 py-0.5 text-[10px] text-label-secondary">
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {section.actionPlan.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {section.actionPlan.map((item) => (
            <div key={item} className="rounded-lg border border-separator bg-fill px-2.5 py-1.5 text-[11px] leading-5 text-label-secondary">
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
