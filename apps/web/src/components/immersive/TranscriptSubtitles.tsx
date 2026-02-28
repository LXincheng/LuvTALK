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
    <div className="w-full max-w-xl mx-auto space-y-2.5">
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
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl border px-3 py-2 backdrop-blur-2xl ${
                  isUser
                    ? 'bg-white/[0.08] border-white/[0.16] text-white/90'
                    : 'bg-cyan-300/[0.10] border-cyan-200/[0.22] text-white'
                }`}
              >
                <p className="text-[13px] leading-relaxed break-words">
                  {entry.text}
                  {entry.draft && (
                    <span className="inline-block w-[2px] h-3 ml-1 align-middle bg-white/45 animate-pulse rounded-full" />
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
