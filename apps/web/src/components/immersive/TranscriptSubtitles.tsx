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
    <div className="w-full max-w-sm mx-auto space-y-2.5">
      <AnimatePresence mode="popLayout">
        {draftEntries.map((entry) => (
          <motion.div
            key={entry.draft ? `${entry.role}-draft` : `${entry.role}-${entry.timestamp}`}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="text-center"
          >
            <span
              className={`inline-block text-[13px] leading-relaxed ${
                entry.role === 'user'
                  ? 'text-white/40'
                  : 'text-white/80'
              }`}
            >
              {entry.text}
              {entry.draft && (
                <span className="inline-block w-[2px] h-3 ml-1 align-middle bg-white/30 animate-pulse rounded-full" />
              )}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
