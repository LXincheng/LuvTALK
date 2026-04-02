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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {draftEntries.map((entry) => {
          const isUser = entry.role === 'user';
          return (
            <motion.div
              key={entry.draft ? `${entry.role}-draft` : `${entry.role}-${entry.timestamp}`}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
              className="flex justify-center"
            >
              <div
                className={`w-full max-w-[96%] rounded-[24px] px-4 py-3 backdrop-blur-2xl ${
                  isUser
                    ? 'bg-black/[0.035] text-slate-800 dark:bg-white/[0.05] dark:text-white/88'
                    : 'bg-slate-900/[0.04] text-slate-900 dark:bg-blue-400/[0.10] dark:text-white'
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`text-[10px] font-medium uppercase tracking-[0.16em] ${
                      isUser
                        ? 'text-slate-500 dark:text-white/45'
                        : 'text-sky-700 dark:text-sky-100/80'
                    }`}
                  >
                    {isUser ? 'You' : 'Tutor'}
                  </span>
                </div>
                <p className="break-words text-[14px] leading-[1.55]">
                  {entry.text}
                  {entry.draft && (
                    <span className="ml-1 inline-block h-3 w-[2px] animate-pulse rounded-full bg-current/45 align-middle" />
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
