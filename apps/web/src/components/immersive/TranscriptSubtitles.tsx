import { AnimatePresence, motion } from 'motion/react';
import type { RealtimeTranscriptEntry } from '../../types/realtime';
import { useLocale } from '../../providers/LocaleContext';

interface TranscriptSubtitlesProps {
  entries: RealtimeTranscriptEntry[];
  activeUserText?: string;
  activeAiText?: string;
  maxItems?: number;
}

export default function TranscriptSubtitles({
  entries,
  activeUserText,
  activeAiText,
  maxItems = 4,
}: TranscriptSubtitlesProps) {
  const { t } = useLocale();
  const normalized = entries.slice(-maxItems);
  const draftEntries: Array<RealtimeTranscriptEntry & { draft?: boolean }> = [
    ...normalized.map((entry) => ({ ...entry, draft: false })),
  ];

  if (activeUserText?.trim()) {
    draftEntries.push({
      role: 'user',
      text: activeUserText,
      timestamp: new Date().toISOString(),
      draft: true,
    });
  }

  if (activeAiText?.trim()) {
    draftEntries.push({
      role: 'ai',
      text: activeAiText,
      timestamp: new Date().toISOString(),
      draft: true,
    });
  }

  if (!draftEntries.length) return null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-2.5">
      <AnimatePresence mode="popLayout">
        {draftEntries.map((entry, index) => {
          const isUser = entry.role === 'user';
          const freshness = Math.max(0.38, 1 - (draftEntries.length - index - 1) * 0.16);
          return (
            <motion.div
              key={entry.draft ? `${entry.role}-draft` : `${entry.role}-${entry.timestamp}`}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: freshness, y: 0, scale: entry.draft ? 1 : 0.992 + freshness * 0.008 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
              className="flex justify-center"
            >
              <div
                className={`relative w-full max-w-[94%] overflow-hidden rounded-[28px] px-4 py-3 backdrop-blur-2xl ${
                  isUser
                    ? 'border border-white/[0.06] bg-white/[0.045] text-white/86 shadow-[0_12px_34px_rgba(0,0,0,0.16)]'
                    : 'border border-sky-200/[0.08] bg-[linear-gradient(180deg,rgba(111,198,255,0.10),rgba(255,255,255,0.035))] text-white shadow-[0_14px_40px_rgba(12,54,118,0.18)]'
                }`}
              >
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 ${
                    isUser
                      ? 'bg-[radial-gradient(circle_at_18%_14%,rgba(255,255,255,0.08),transparent_30%)]'
                      : 'bg-[radial-gradient(circle_at_16%_14%,rgba(203,238,255,0.12),transparent_28%)]'
                  }`}
                />
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`text-[10px] font-medium uppercase tracking-[0.16em] ${
                      isUser
                        ? 'text-white/42'
                        : 'text-sky-100/72'
                    }`}
                  >
                    {isUser ? t('immersiveCaptionYou') : t('immersiveCaptionTutor')}
                  </span>
                </div>
                <p className="relative break-words text-[14px] leading-[1.68] text-balance">
                  {entry.text}
                  {entry.draft && (
                    <span className="ml-1 inline-block h-3 w-[2px] animate-pulse rounded-full bg-current/55 align-middle" />
                  )}
                </p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
