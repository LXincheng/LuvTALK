import { useState } from 'react';
import { motion } from 'motion/react';
import { Volume2 } from 'lucide-react';

interface ReviewFlipCardProps {
  term: string;
  translation: string;
  example?: string;
  onSpeak?: () => void;
  speakLabel?: string;
  flipHint?: string;
}

export default function ReviewFlipCard({
  term,
  translation,
  example,
  onSpeak,
  speakLabel,
  flipHint = 'Tap to flip',
}: ReviewFlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className="relative w-full cursor-pointer"
      style={{ perspective: '1000px' }}
      onClick={() => setIsFlipped((prev) => !prev)}
    >
      <motion.div
        className="relative w-full"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front */}
        <div
          className="w-full glass-card rounded-2xl border border-separator p-6 sm:p-8 min-h-[180px] flex flex-col items-center justify-center gap-3"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <p className="text-2xl sm:text-3xl font-bold text-label text-center break-words">
            {term}
          </p>
          {onSpeak && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSpeak();
              }}
              className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-separator text-sm text-label-secondary hover:bg-fill-secondary transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              {speakLabel}
            </button>
          )}
          <p className="text-xs text-label-tertiary mt-2">{flipHint}</p>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 w-full glass-card rounded-2xl border border-separator p-6 sm:p-8 min-h-[180px] flex flex-col items-center justify-center gap-3"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <p className="text-xl sm:text-2xl font-semibold text-label text-center break-words">
            {translation}
          </p>
          {example && (
            <p className="text-sm text-label-secondary text-center italic mt-1">
              {example}
            </p>
          )}
          <p className="text-xs text-label-tertiary mt-2">{flipHint}</p>
        </div>
      </motion.div>
    </div>
  );
}
