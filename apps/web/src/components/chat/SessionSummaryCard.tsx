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
  emptyText,
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
  const [expanded, setExpanded] = useState(true);

  return (
    <section className="mx-3 sm:mx-4 mt-3 sm:mt-4 rounded-2xl border border-white/45 bg-white/55 dark:bg-slate-900/55 backdrop-blur-xl shadow-sm overflow-hidden w-auto max-w-full">
      <div className="px-3 sm:px-4 py-3 border-b border-white/40 dark:border-slate-700/60 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white min-w-0">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <h3 className="text-base sm:text-lg font-semibold truncate">{title}</h3>
          </div>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
            {subtitle}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full md:w-auto md:flex md:items-center md:gap-2 shrink-0">
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700 px-2.5 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/60"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? collapseText : expandText}
          </button>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700 px-2.5 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/60 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {refreshText}
          </button>
        </div>
      </div>

      {isLoading && !summary ? (
        <div className="px-3 sm:px-4 py-5 text-base text-slate-600 dark:text-slate-400">{loadingText}</div>
      ) : null}

      {!isLoading && !summary ? (
        <div className="px-3 sm:px-4 py-5 text-base text-slate-600 dark:text-slate-400">{emptyText}</div>
      ) : null}

      {summary && !expanded ? (
        <div className="px-3 sm:px-4 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
          className="px-3 sm:px-4 py-4 space-y-4"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
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

          <Section title={strengthsTitle} items={summary.strengths} dotClass="bg-emerald-500" />
          <Section title={improvementsTitle} items={summary.improvements} dotClass="bg-amber-500" />
          <Section title={nextActionsTitle} items={summary.recommendedNextActions} dotClass="bg-indigo-500" />

          {summary.keyTerms.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{keyTermsTitle}</p>
              <div className="flex flex-wrap gap-2 min-w-0">
                {summary.keyTerms.map((item) => (
                  <span
                    key={item.term}
                    className="max-w-full truncate rounded-full border border-slate-200/80 dark:border-slate-700 bg-white/70 dark:bg-slate-800/60 px-3 py-1 text-sm text-slate-700 dark:text-slate-300"
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
    <div className="rounded-xl border border-white/45 dark:border-slate-700/70 bg-white/65 dark:bg-slate-800/60 py-2.5 px-2 text-slate-700 dark:text-slate-300 min-w-0">
      <div className="flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-slate-400 min-w-0">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="text-base font-semibold mt-0.5 break-all">{value}</p>
    </div>
  );
}

function Section({ title, items, dotClass }: { title: string; items: string[]; dotClass: string }) {
  return (
    <div className="rounded-xl border border-white/45 dark:border-slate-700/70 bg-white/50 dark:bg-slate-800/45 p-3">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{title}</p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={`${title}-${item}`} className="flex items-start gap-2">
            <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${dotClass}`} />
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed break-words">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
