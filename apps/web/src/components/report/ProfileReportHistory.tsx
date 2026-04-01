import { ChevronRight, Download, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useLocale } from '../../providers/LocaleContext';
import type {
  ConversationReportHistoryItem,
  ConversationReportPayload,
} from '../../types/api';
import {
  formatReportTimestamp,
  formatMinutesValue,
  formatScoreValue,
} from '../../utils/report-format';
import { downloadConversationReportPdf } from '../../utils/report-pdf';
import ConversationReportPanel from './ConversationReportPanel';

interface ProfileReportHistoryProps {
  history: ConversationReportHistoryItem[];
  selectedReportId: string | null;
  selectedReport: ConversationReportPayload | null;
  isLoading: boolean;
  isGuest: boolean;
  onSelectReport: (reportId: string) => void;
  onRefreshSelected?: () => void;
}

export default function ProfileReportHistory({
  history,
  selectedReportId,
  selectedReport,
  isLoading,
  isGuest,
  onSelectReport,
  onRefreshSelected,
}: ProfileReportHistoryProps) {
  const { t, locale } = useLocale();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const listItems = isGuest ? [] : history;

  const activeReport =
    selectedReport && selectedReport.id === selectedReportId
      ? selectedReport
      : null;

  const openViewer = (id: string) => {
    onSelectReport(id);
    setViewerId(id);
  };

  const closeViewer = () => {
    setViewerId(null);
    setIsDownloadingPdf(false);
  };

  const handleDownloadPdf = async () => {
    if (!activeReport || isDownloadingPdf) {
      return;
    }
    setIsDownloadingPdf(true);
    try {
      await downloadConversationReportPdf(activeReport);
    } catch (error) {
      console.error('Failed to export conversation report PDF', error);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const isEmpty = listItems.length === 0;

  return (
    <>
      {/* ── List card ── */}
      <section className="glass-card mb-6 rounded-2xl border border-separator p-4 shadow-sm sm:p-[18px]">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-label">{t('profileReportsTitle')}</h2>
          </div>
          {!isEmpty ? (
            <span className="rounded-full border border-separator bg-fill px-2.5 py-0.5 text-xs tabular-nums text-label-secondary">
              {listItems.length}
            </span>
          ) : null}
        </div>

        {/* Empty / Guest hint */}
        {isEmpty ? (
          <p className="py-4 text-center text-sm text-label-tertiary">
            {isGuest ? t('profileReportsGuestHint') : t('profileReportsEmpty')}
          </p>
        ) : (
          <div className="space-y-2">
            {listItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openViewer(item.id)}
                className="group flex w-full items-center gap-3 rounded-[22px] border border-separator bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,250,255,0.88))] px-4 py-3.5 text-left shadow-sm transition hover:border-primary/20 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(235,245,255,0.9))] dark:bg-[linear-gradient(180deg,rgba(28,28,30,0.92),rgba(20,22,28,0.88))]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-label break-words">
                      {item.headline}
                    </p>
                    {isGuest ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                        {t('profileReportsSampleBadge')}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-5 text-label-secondary">
                    {item.overallSummary.length > 90
                      ? `${item.overallSummary.slice(0, 90).trimEnd()}...`
                      : item.overallSummary}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-label-secondary">
                    <span className="rounded-full bg-fill px-2 py-0.5 tabular-nums">
                      {formatScoreValue(t, item.averageScore, 'reportScore')}
                    </span>
                    <span className="rounded-full bg-fill px-2 py-0.5 tabular-nums">
                      {formatMinutesValue(t, item.durationMinutes, 'profile')}
                    </span>
                    <span className="rounded-full bg-fill px-2 py-0.5 tabular-nums">
                      {formatReportTimestamp(locale, t, item.updatedAt)}
                    </span>
                  </div>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fill text-label-tertiary transition group-hover:bg-[var(--color-primary-soft)] group-hover:text-primary">
                  <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Viewer overlay ── */}
      <AnimatePresence>
        {viewerId ? (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[3px]"
              onClick={closeViewer}
            />

            <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-5">
              {/* Panel — bottom sheet on mobile, centered dialog on sm+ */}
              <motion.div
                initial={{ opacity: 0, y: 48, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 48, scale: 0.98 }}
                transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                onClick={(event) => event.stopPropagation()}
                className={[
                  'flex w-full flex-col',
                  'max-h-[92dvh] rounded-t-[24px] border border-separator bg-surface-elevated shadow-[0_10px_50px_rgba(0,0,0,0.16)] dark:shadow-[0_10px_50px_rgba(0,0,0,0.5)]',
                  'sm:w-[min(760px,calc(100vw-3rem))] sm:max-h-[88dvh] sm:rounded-[28px]',
                ].join(' ')}
              >
                {/* Drag handle (mobile only) */}
                <div className="flex justify-center pb-1 pt-3 sm:hidden">
                  <div className="h-1 w-10 rounded-full bg-fill" />
                </div>

                {/* Modal header */}
                <div className="flex items-center justify-between gap-3 border-b border-separator px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-label">
                      {t('reportShort')}
                    </p>
                    <p className="mt-0.5 text-xs text-label-tertiary">
                      {activeReport
                        ? formatReportTimestamp(locale, t, activeReport.updatedAt)
                        : t('reportGenerating')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {activeReport ? (
                      <button
                        type="button"
                        onClick={handleDownloadPdf}
                        disabled={isDownloadingPdf}
                        aria-busy={isDownloadingPdf}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-separator bg-fill px-3 py-1.5 text-xs font-medium text-label-secondary transition hover:bg-fill-secondary disabled:opacity-50"
                      >
                        <Download className={`h-3.5 w-3.5 ${isDownloadingPdf ? 'animate-pulse' : ''}`} />
                        {t('reportExport')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={closeViewer}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-separator bg-fill text-label-secondary transition hover:bg-fill-secondary"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Modal body */}
                <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
                  <ConversationReportPanel
                    report={activeReport}
                    isLoading={isGuest ? false : isLoading}
                    onRefresh={isGuest ? undefined : onRefreshSelected}
                  />
                </div>
              </motion.div>
            </div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
