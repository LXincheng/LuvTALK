import { ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useLocale } from '../../providers/LocaleContext';
import type { SessionSummaryPayload } from '../../types/api';

interface SessionSummaryCardProps {
  summary: SessionSummaryPayload | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export default function SessionSummaryCard({
  summary,
  isLoading,
  onRefresh,
}: SessionSummaryCardProps) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);

  if (!isLoading && !summary) {
    return null;
  }

  return (
    <section className="relative mx-3 mt-2 mb-1 overflow-hidden rounded-2xl border border-separator bg-white/92 shadow-[0_2px_8px_rgba(15,23,42,0.04)] backdrop-blur-[16px] sm:mx-4 dark:bg-[rgba(24,24,27,0.88)]">
      {/* Header row: badge + metrics + controls */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 sm:px-4">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-separator bg-white/70 px-2 py-0.5 text-xs text-label-secondary dark:bg-white/8">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="hidden sm:inline">{t('sessionSummaryTitle')}</span>
        </span>

        {summary ? (
          <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-x-auto text-[13px] scrollbar-none">
            <Metric label={t('sessionSummaryMetricAverage')} value={summary.averageScore ?? '--'} />
            <Dot />
            <Metric label={t('sessionSummaryMetricLatest')} value={summary.latestScore ?? '--'} />
            <Dot />
            <Metric label={t('sessionSummaryMetricTurns')} value={`${summary.userTurns}/${summary.aiTurns}`} />
            <Dot />
            <Metric label={t('sessionSummaryMetricMinutes')} value={summary.durationMinutes} />
          </div>
        ) : (
          <span className="flex-1 text-[13px] text-label-tertiary">{t('sessionSummaryLoading')}</span>
        )}

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-separator bg-white/60 text-label-tertiary transition hover:bg-white/80 disabled:opacity-50 dark:bg-white/5"
            aria-label={t('commonRetry')}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {summary ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-separator bg-white/60 text-label-tertiary transition hover:bg-white/80 dark:bg-white/5"
              aria-label={expanded ? t('sessionSummaryCollapse') : t('sessionSummaryExpand')}
            >
              <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? 'rotate-180' : ''}`} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Expandable detail */}
      {expanded && summary ? (
        <div className="border-t border-separator/50 px-3.5 py-2.5 sm:px-4">
          {summary.strengths[0] ? (
            <p className="text-[13px] leading-relaxed text-label">
              <span className="mr-1 font-medium text-emerald-600 dark:text-emerald-400">+</span>
              {summary.strengths[0]}
            </p>
          ) : null}
          {summary.improvements[0] ? (
            <p className="mt-1 text-[13px] leading-relaxed text-label-secondary">
              <span className="mr-1 font-medium text-amber-600 dark:text-amber-400">△</span>
              {summary.improvements[0]}
            </p>
          ) : null}
          {summary.keyTerms[0] ? (
            <span className="mt-1.5 inline-block rounded-full border border-separator bg-white/72 px-2.5 py-0.5 text-xs text-label-secondary dark:bg-white/8">
              {summary.keyTerms[0].term}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex shrink-0 items-baseline gap-1">
      <span className="text-label-tertiary">{label}</span>
      <span className="font-semibold tabular-nums text-label">{value}</span>
    </span>
  );
}

function Dot() {
  return <span className="text-xs text-separator">·</span>;
}
