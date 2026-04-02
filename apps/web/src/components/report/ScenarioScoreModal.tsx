import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RotateCcw, X } from 'lucide-react';
import { useLocale } from '../../providers/LocaleContext';
import type { ScenarioFeedback } from '../scenario/types';
import type { LocaleKey } from '../../providers/LocaleContext';

interface ScenarioScoreModalProps {
  open: boolean;
  title: string;
  feedback?: ScenarioFeedback | null;
  isLoading?: boolean;
  errorMessage?: string | null;
  onRefresh?: () => void;
  onClose: () => void;
  onRetry?: () => void;
  onNext?: () => void;
}

const useReducedMotionPreference = () => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return reduced;
};

function ScoreCounter({ value, reduced }: { value: number; reduced: boolean }) {
  const [displayValue, setDisplayValue] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setDisplayValue(value);
      return;
    }

    let frame = 0;
    const durationMs = 720;
    const startTime = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / durationMs, 1);
      const eased = 1 - (1 - progress) * (1 - progress) * (1 - progress);
      setDisplayValue(Math.round(value * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced, value]);

  return <span>{displayValue}</span>;
}

export default function ScenarioScoreModal({
  open,
  title,
  feedback,
  isLoading = false,
  errorMessage,
  onRefresh,
  onClose,
  onRetry,
  onNext,
}: ScenarioScoreModalProps) {
  const { t } = useLocale();
  const reducedMotion = useReducedMotionPreference();
  const dimensionLabelMap: Record<
    NonNullable<ScenarioFeedback['dimensions']>[number]['key'],
    LocaleKey
  > = {
    taskCompletion: 'scenarioDimensionTaskCompletion',
    naturalness: 'scenarioDimensionNaturalness',
    pronunciation: 'scenarioDimensionPronunciation',
    resilience: 'scenarioDimensionResilience',
  };

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return undefined;
    }
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const scoreTone = useMemo(() => {
    if (!feedback) return 'var(--color-primary)';
    if (feedback.overallScore >= 88) return 'var(--color-success)';
    if (feedback.overallScore >= 72) return 'var(--color-primary)';
    return 'var(--color-warning)';
  }, [feedback]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.12 : 0.2 }}
        >
          <motion.button
            type="button"
            aria-label={t('commonClose')}
            className="absolute inset-0 bg-[rgba(7,10,16,0.5)]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="relative flex w-full min-h-[28rem] max-h-[min(88vh,52rem)] max-w-[min(96vw,46rem)] flex-col overflow-hidden rounded-[30px] border border-separator bg-[linear-gradient(180deg,rgba(255,255,255,0.995),rgba(247,249,253,0.985))] p-4 shadow-[0_18px_50px_rgba(10,18,30,0.18)] dark:bg-[linear-gradient(180deg,rgba(22,26,34,0.995),rgba(16,19,26,0.99))] sm:min-h-[32rem] sm:p-5"
            initial={reducedMotion ? { opacity: 0.98 } : { opacity: 0, y: 18, scale: 0.96 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 }}
            transition={{ duration: reducedMotion ? 0.12 : 0.28, type: 'spring', bounce: 0.18 }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.26),rgba(255,255,255,0))] dark:bg-[radial-gradient(circle_at_top,rgba(87,136,255,0.08),rgba(255,255,255,0))]" />
            <div className="pointer-events-none absolute -right-10 top-0 h-36 w-36 rounded-full bg-primary/8 blur-3xl" />
            <div className="pointer-events-none absolute inset-x-6 top-[92px] h-px bg-gradient-to-r from-transparent via-separator to-transparent" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-label-tertiary">
                  {t('scenarioScoreModalBadge')}
                </p>
                <h3 className="mt-2 truncate text-[1rem] font-semibold tracking-[-0.035em] text-label sm:text-[1.08rem]">
                  {title}
                </h3>
                {feedback?.headline ? (
                  <p className="mt-1.5 text-[13px] leading-5 text-label-secondary sm:text-sm">
                    {feedback.headline}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="page-chip press-scale inline-flex h-9 w-9 items-center justify-center rounded-full text-label-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="rounded-[26px] border border-separator bg-[rgba(255,255,255,0.98)] px-4 py-5 dark:bg-[rgba(255,255,255,0.035)] sm:px-5 sm:py-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[0.95rem] font-semibold tracking-[-0.03em] text-label">
                      {t('scenarioScoreModalLoading')}
                    </p>
                    <p className="mt-1.5 max-w-[26rem] text-sm leading-6 text-label-secondary">
                      {t('scenarioScoreModalLoadingHint')}
                    </p>
                  </div>
                  <div className="relative h-12 w-12 shrink-0 rounded-full border border-separator bg-[rgba(255,255,255,0.88)] dark:bg-[rgba(255,255,255,0.045)]">
                    <motion.div
                      aria-hidden
                      className="absolute inset-[4px] rounded-full border border-primary/20"
                      animate={reducedMotion ? undefined : { rotate: 360 }}
                      transition={reducedMotion ? undefined : { duration: 1.8, repeat: Infinity, ease: 'linear' }}
                    />
                    <motion.div
                      aria-hidden
                      className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/65"
                      animate={reducedMotion ? undefined : { opacity: [0.45, 1, 0.45], scale: [0.9, 1, 0.9] }}
                      transition={reducedMotion ? undefined : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                </div>
                <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  <div className="page-panel-soft rounded-[20px] px-4 py-3">
                    <div className="h-3 w-20 animate-pulse rounded-full bg-fill" />
                    <div className="mt-2.5 h-3 w-[82%] animate-pulse rounded-full bg-fill" />
                  </div>
                  <div className="page-panel-soft rounded-[20px] px-4 py-3">
                    <div className="h-3 w-16 animate-pulse rounded-full bg-fill" />
                    <div className="mt-2.5 h-3 w-[70%] animate-pulse rounded-full bg-fill" />
                  </div>
                </div>
              </div>
            ) : !feedback ? (
              <div className="rounded-[22px] bg-fill-secondary px-4 py-5">
                <p className="text-sm leading-6 text-label-secondary">
                  {errorMessage || t('scenarioScoreModalError')}
                </p>
                {onRefresh ? (
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="press-scale mt-4 inline-flex h-10 items-center justify-center rounded-[14px] bg-primary px-4 text-sm font-medium text-white"
                  >
                    {t('commonRetry')}
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
                  <div className="rounded-[28px] border border-separator bg-[rgba(255,255,255,0.94)] px-4 py-4 dark:bg-[rgba(255,255,255,0.04)] sm:px-5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-label-tertiary">
                      {t('scenarioScoreModalOverall')}
                    </p>
                    <div className="mt-3 flex items-end gap-2">
                      <div
                        className="text-[2.2rem] font-semibold leading-none tracking-[-0.08em] sm:text-[2.65rem]"
                        style={{ color: scoreTone }}
                      >
                        <ScoreCounter value={feedback.overallScore} reduced={reducedMotion} />
                      </div>
                      <span className="pb-1 text-[13px] font-medium text-label-tertiary">/100</span>
                    </div>
                    <p className="mt-2.5 text-[13px] leading-6 text-label-secondary sm:text-sm">
                      {feedback.summary}
                    </p>
                  </div>

                  <div className="rounded-[28px] border border-separator bg-[rgba(255,255,255,0.9)] px-4 py-4 dark:bg-[rgba(255,255,255,0.04)]">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-label-tertiary">
                      {t('scenarioScoreModalHighlights')}
                    </p>
                    <div className="mt-3 space-y-2.5">
                    {feedback.dimensions.map((dimension, index) => (
                      <motion.div
                        key={dimension.key}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[16px] border border-separator bg-[rgba(255,255,255,0.82)] px-3.5 py-2.5 dark:bg-[rgba(255,255,255,0.035)]"
                        initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                        transition={{ delay: reducedMotion ? 0 : 0.04 * index, duration: 0.18 }}
                      >
                        <span className="text-[13px] leading-5 text-label-secondary sm:text-sm">
                          {t(dimensionLabelMap[dimension.key])}
                        </span>
                        <span className="text-[15px] font-semibold tracking-[-0.03em] text-label">
                          {dimension.score}
                        </span>
                      </motion.div>
                    ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 rounded-[26px] border border-separator bg-[rgba(255,255,255,0.92)] px-4 py-4 dark:bg-[rgba(255,255,255,0.04)] sm:px-5">
                  <h4 className="text-[11px] font-medium uppercase tracking-[0.18em] text-label-tertiary">
                    {t('scenarioScoreModalSuggestions')}
                  </h4>
                  <div className="mt-2.5 space-y-2">
                    {feedback.suggestions.map((suggestion, index) => (
                      <motion.div
                        key={`${suggestion}-${index}`}
                        className="rounded-[18px] border border-separator bg-[rgba(255,255,255,0.84)] px-4 py-2.5 dark:bg-[rgba(255,255,255,0.03)]"
                        initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                        transition={{ delay: reducedMotion ? 0 : 0.1 + (index * 0.04), duration: 0.18 }}
                      >
                        <div className="flex items-start gap-3">
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-fill px-1.5 text-[11px] font-medium text-label-tertiary">
                            {index + 1}
                          </span>
                          <p className="text-[13px] leading-6 text-label-secondary sm:text-sm">
                            {suggestion}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </>
            )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2.5 border-t border-separator pt-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={isLoading ? onClose : onRetry}
                className="page-chip press-scale inline-flex h-12 items-center justify-center gap-2 rounded-[16px] px-4 text-sm font-medium text-label"
              >
                {!isLoading ? <RotateCcw className="h-4 w-4" /> : null}
                {isLoading ? t('commonClose') : t('scenarioScoreModalRetry')}
              </button>
              <button
                type="button"
                onClick={isLoading ? undefined : (onNext ?? onClose)}
                disabled={isLoading}
                className="press-scale inline-flex h-12 items-center justify-center rounded-[16px] bg-primary px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-72"
              >
                {isLoading ? t('scenarioScoreModalLoadingAction') : t('scenarioScoreModalNext')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
