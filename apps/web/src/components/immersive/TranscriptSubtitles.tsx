import { AnimatePresence, motion } from 'motion/react';
import type { RealtimeTranscriptEntry } from '../../types/realtime';

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
                className={`w-full max-w-[94%] rounded-[28px] px-4 py-3 backdrop-blur-2xl ${
                  isUser
                    ? 'border border-white/[0.06] bg-white/[0.05] text-white/86 shadow-[0_16px_44px_rgba(0,0,0,0.18)]'
                    : 'border border-sky-200/[0.10] bg-[linear-gradient(180deg,rgba(111,198,255,0.12),rgba(255,255,255,0.04))] text-white shadow-[0_18px_48px_rgba(12,54,118,0.24)]'
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`text-[10px] font-medium uppercase tracking-[0.16em] ${
                      isUser
                        ? 'text-white/42'
                        : 'text-sky-100/72'
                    }`}
                  >
                    {isUser ? 'You' : 'Tutor'}
                  </span>
                </div>
                <p className="break-words text-[14px] leading-[1.6] text-balance">
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
