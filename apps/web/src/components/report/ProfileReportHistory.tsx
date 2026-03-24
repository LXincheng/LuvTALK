import { ChevronRight, Download, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useLocale } from '../../providers/LocaleContext';
import type {
  ConversationReportHistoryItem,
  ConversationReportPayload,
} from '../../types/api';
import {
  formatReportTimestamp,
  formatScoreValue,
  getReportModeLabelKey,
} from '../../utils/report-format';
import { createSampleConversationReport, toSampleHistoryItem } from '../../utils/report-sample';
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

  const sampleReport = useMemo(() => createSampleConversationReport(t), [t]);
  const listItems = isGuest ? [toSampleHistoryItem(sampleReport)] : history;

  const activeReport =
    isGuest
      ? sampleReport
      : selectedReport && selectedReport.id === selectedReportId
        ? selectedReport
        : null;

  const openViewer = (id: string) => {
    onSelectReport(id);
    setViewerId(id);
  };

  const closeViewer = () => setViewerId(null);

  const isEmpty = listItems.length === 0;

  return (
    <>
      {/* ── List card ── */}
      <section className="glass-card mb-6 rounded-2xl border border-separator p-4 shadow-sm sm:p-5">
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
          <div className="space-y-1.5">
            {listItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openViewer(item.id)}
                className="group flex w-full items-center gap-3 rounded-xl border border-separator bg-fill px-3 py-2.5 text-left transition hover:bg-fill-secondary"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-label line-clamp-1">{item.headline}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-label-tertiary">
                    <span>{t(getReportModeLabelKey(item.sourceMode))}</span>
                    <span>·</span>
                    <span className="tabular-nums">{formatScoreValue(t, item.averageScore, 'reportScore')}</span>
                    <span>·</span>
                    <span className="tabular-nums">{formatReportTimestamp(locale, t, item.updatedAt)}</span>
                    {isGuest ? (
                      <>
                        <span>·</span>
                        <span className="text-primary">{t('profileReportsSampleBadge')}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-label-tertiary transition group-hover:translate-x-0.5" />
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
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
              onClick={closeViewer}
            />

            {/* Panel — bottom sheet on mobile, centered dialog on sm+ */}
            <motion.div
              initial={{ opacity: 0, y: 48 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 48 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={[
                'fixed z-50 flex flex-col',
                /* mobile: full-width bottom sheet */
                'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[22px]',
                /* sm+: centered dialog */
                'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-[5dvh]',
                'sm:-translate-x-1/2 sm:w-[min(760px,calc(100vw-2.5rem))]',
                'sm:max-h-[88dvh] sm:rounded-2xl',
                /* surface */
                'border border-separator bg-surface-elevated shadow-[0_8px_40px_rgba(0,0,0,0.14)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)]',
              ].join(' ')}
            >
              {/* Drag handle (mobile only) */}
              <div className="flex justify-center pb-1 pt-3 sm:hidden">
                <div className="h-1 w-10 rounded-full bg-fill" />
              </div>

              {/* Modal header */}
              <div className="flex items-center justify-between gap-3 border-b border-separator px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-label">
                    {activeReport?.report.headline ?? t('reportTitle')}
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
                      onClick={() => downloadConversationReportPdf(activeReport)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-separator bg-fill px-3 py-1.5 text-xs font-medium text-label-secondary transition hover:bg-fill-secondary"
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
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
              <div className="flex-1 overflow-y-auto p-4">
                <ConversationReportPanel
                  report={activeReport}
                  isLoading={isGuest ? false : isLoading}
                  onRefresh={isGuest ? undefined : onRefreshSelected}
                />
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
