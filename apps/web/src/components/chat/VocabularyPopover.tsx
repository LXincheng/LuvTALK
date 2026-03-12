import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Star, X, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocale } from '../../providers/LocaleContext';
import type { Annotation } from '../../types/chat';

interface VocabularyPopoverProps {
  word: string;
  explanation: string;
  examples?: string[];
  type?: string;
  onSave?: (payload: Annotation) => void;
}

export default function VocabularyPopover({
  word,
  explanation,
  examples,
  type,
  onSave,
}: VocabularyPopoverProps) {
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  const handleSave = () => {
    setIsSaved((prev) => !prev);
    if (!isSaved) {
      onSave?.({ word, explanation, examples, type });
    }
  };

  const computePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const popoverW = 320;
    const popoverMaxH = 400;
    const pad = 8;

    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < popoverMaxH + pad && rect.top > spaceBelow;

    setPopoverStyle({
      position: 'fixed',
      top: placeAbove ? undefined : rect.bottom + pad,
      bottom: placeAbove ? window.innerHeight - rect.top + pad : undefined,
      left: Math.max(
        pad,
        Math.min(
          rect.left + rect.width / 2 - popoverW / 2,
          window.innerWidth - popoverW - pad,
        ),
      ),
      width: popoverW,
      maxWidth: `calc(100vw - ${pad * 2}px)`,
      zIndex: 9999,
    });
  }, []);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) computePosition();
    setIsOpen((prev) => !prev);
  };

  return (
    <span className="relative inline">
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="underline decoration-dotted decoration-primary decoration-2 underline-offset-2 hover:decoration-solid text-primary transition-all cursor-pointer"
      >
        {word}
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              <div
                className="fixed inset-0"
                style={{ zIndex: 9998 }}
                onClick={() => setIsOpen(false)}
              />
              <motion.div
                key="popover"
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                style={popoverStyle}
              >
                <div className="glass-card rounded-2xl p-4 shadow-2xl border border-separator max-h-[70vh] overflow-y-auto">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4 text-primary" />
                      </div>
                      <h4 className="font-semibold text-label">
                        {word}
                      </h4>
                    </div>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1 hover:bg-fill-secondary rounded-lg transition-colors shrink-0"
                    >
                      <X className="w-4 h-4 text-label-tertiary" />
                    </button>
                  </div>

                  <div className="mb-3">
                    <p className="text-sm text-label-secondary leading-relaxed">
                      {explanation}
                    </p>
                  </div>

                  {examples && examples.length > 0 && (
                    <div className="mb-3 p-3 bg-primary/5 rounded-xl border border-primary/15">
                      <p className="text-xs font-medium text-primary mb-2">
                        {t('vocabExamples')}
                      </p>
                      <ul className="space-y-1">
                        {examples.map((example) => (
                          <li
                            key={example}
                            className="text-sm text-label-secondary italic"
                          >
                            {example}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button
                    onClick={handleSave}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                      isSaved
                        ? 'bg-primary text-white'
                        : 'bg-fill text-label-secondary hover:bg-fill-secondary'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                    {isSaved ? t('vocabSaved') : t('vocabSave')}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </span>
  );
}

