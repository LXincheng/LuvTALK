import { ChevronDown, ChevronUp, RefreshCw, Sparkles, Target, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { SessionSummaryPayload } from '../../types/api';

interface SessionSummaryCardProps {
  title: string;
  subtitle: string;
  loadingText: string;
  refreshText: string;
  strengthsTitle: string;
  improvementsTitle: string;
  nextActionsTitle: string;
  keyTermsTitle: string;
  emptyText: string;
  collapseText: string;
  expandText: string;
  averageLabel: string;
  latestLabel: string;
  turnsLabel: string;
  minutesLabel: string;
  summary: SessionSummaryPayload | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export default function SessionSummaryCard({
  title,
  subtitle,
  loadingText,
  refreshText,
  strengthsTitle,
  improvementsTitle,
  nextActionsTitle,
  keyTermsTitle,
  collapseText,
  expandText,
  averageLabel,
  latestLabel,
  turnsLabel,
  minutesLabel,
  summary,
  isLoading,
  onRefresh,
}: SessionSummaryCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!isLoading && !summary) {
    return null;
  }

  return (
    <section className="mx-3 sm:mx-4 mt-2 sm:mt-3 rounded-xl border border-white/55 bg-white/70 dark:bg-slate-900/65 backdrop-blur-xl shadow-sm overflow-hidden w-auto max-w-full">
      <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-slate-900 dark:text-white min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <h3 className="text-sm sm:text-base font-semibold truncate">{title}</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate hidden sm:block">
            {subtitle}
          </p>
        </div>
        {summary ? (
          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            <Badge label={averageLabel} value={summary.averageScore?.toString() ?? '--'} />
            <Badge label={minutesLabel} value={summary.durationMinutes.toString()} />
          </div>
        ) : null}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200/80 dark:border-slate-700 px-2 py-1.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/60"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span className="hidden sm:inline">{expanded ? collapseText : expandText}</span>
          </button>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200/80 dark:border-slate-700 px-2 py-1.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/60 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshText}</span>
          </button>
        </div>
      </div>

      {isLoading && !summary ? (
        <div className="px-3 sm:px-4 pb-3 text-sm text-slate-600 dark:text-slate-400">{loadingText}</div>
      ) : null}

      {summary ? (
        <div className="px-3 sm:px-4 pb-2.5 sm:pb-3">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            <MetricChip
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              label={averageLabel}
              value={summary.averageScore?.toString() ?? '--'}
            />
            <MetricChip
              icon={<Target className="w-3.5 h-3.5" />}
              label={latestLabel}
              value={summary.latestScore?.toString() ?? '--'}
            />
            <MetricChip
              icon={<Sparkles className="w-3.5 h-3.5" />}
              label={turnsLabel}
              value={`${summary.userTurns}/${summary.aiTurns}`}
            />
            <MetricChip
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              label={minutesLabel}
              value={summary.durationMinutes.toString()}
            />
          </div>
        </div>
      ) : null}

      {summary && expanded ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2.5 border-t border-white/45 dark:border-slate-700/60"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <CompactPoint title={strengthsTitle} item={summary.strengths[0]} tone="good" />
            <CompactPoint title={improvementsTitle} item={summary.improvements[0]} tone="warn" />
            <CompactPoint
              title={nextActionsTitle}
              item={summary.recommendedNextActions[0]}
              tone="accent"
            />
          </div>

          {summary.keyTerms.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {keyTermsTitle}
              </p>
              <div className="flex flex-wrap gap-2 min-w-0">
                {summary.keyTerms.slice(0, 4).map((item) => (
                  <span
                    key={item.term}
                    className="max-w-full truncate rounded-full border border-slate-200/80 dark:border-slate-700 bg-white/70 dark:bg-slate-800/60 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300"
                    title={item.definition}
                  >
                    {item.term}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </section>
  );
}

function MetricChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/45 dark:border-slate-700/70 bg-white/65 dark:bg-slate-800/60 py-1.5 px-1.5 sm:px-2 text-slate-700 dark:text-slate-300 min-w-0">
      <div className="flex items-center justify-center gap-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 min-w-0">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="text-sm sm:text-base font-semibold mt-0.5 break-all text-center">{value}</p>
    </div>
  );
}

function CompactPoint({
  title,
  item,
  tone,
}: {
  title: string;
  item: string | undefined;
  tone: 'good' | 'warn' | 'accent';
}) {
  const toneClass =
    tone === 'good'
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
      : tone === 'warn'
        ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
        : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300';

  return (
    <div className={`rounded-lg border px-2.5 py-2 ${toneClass}`}>
      <p className="text-[11px] font-semibold tracking-wide uppercase opacity-80">{title}</p>
      <p className="text-xs sm:text-sm leading-relaxed mt-1 text-slate-700 dark:text-slate-200 break-words">
        {item ?? '--'}
      </p>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200/80 dark:border-slate-700 bg-white/70 dark:bg-slate-800/60 px-2 py-1">
      <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-1">{label}</span>
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );
}
