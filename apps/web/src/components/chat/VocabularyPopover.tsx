import { useState } from 'react';
import { Star, X, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocale } from '../../providers/LocaleContext';
import type { Annotation } from '../../types/chat';

interface VocabularyPopoverProps {
  word: string;
  explanation: string;
  examples?: string[];
  onSave?: (payload: Annotation) => void;
}

export default function VocabularyPopover({
  word,
  explanation,
  examples,
  onSave,
}: VocabularyPopoverProps) {
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved((prev) => !prev);
    if (!isSaved) {
      onSave?.({ word, explanation, examples });
    }
  };

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="underline decoration-dotted decoration-indigo-500 dark:decoration-indigo-400 decoration-2 underline-offset-2 hover:decoration-solid text-indigo-700 dark:text-indigo-300 transition-all cursor-pointer"
      >
        {word}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute left-0 top-full mt-2 z-50 w-80 max-w-[90vw]"
            >
              <div className="glass-card rounded-2xl p-4 shadow-2xl border border-white/20 dark:border-white/10">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 dark:bg-indigo-400/20 flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                      {word}
                    </h4>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  </button>
                </div>

                <div className="mb-3">
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {explanation}
                  </p>
                </div>

                {examples && examples.length > 0 && (
                  <div className="mb-3 p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100/50 dark:border-indigo-900/50">
                    <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-2">
                      {t('vocabExamples')}
                    </p>
                    <ul className="space-y-1">
                      {examples.map((example) => (
                        <li
                          key={example}
                          className="text-sm text-slate-600 dark:text-slate-400 italic"
                        >
                          • {example}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={handleSave}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                    isSaved
                      ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Star className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                  {isSaved ? t('vocabSaved') : t('vocabSave')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </span>
  );
}
