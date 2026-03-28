import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

export interface QuickReplyOption {
  id: string;
  text: string;
}

interface ChatQuickRepliesProps {
  visible: boolean;
  options: QuickReplyOption[];
  disabled?: boolean;
  onSelect: (text: string) => void;
  onClose: () => void;
}

export default function ChatQuickReplies({
  visible,
  options,
  disabled = false,
  onSelect,
  onClose,
}: ChatQuickRepliesProps) {
  return (
    <AnimatePresence initial={false}>
      {visible && options.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.985 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="pointer-events-auto"
        >
          <div className="scrollbar-none flex items-center gap-2 overflow-x-auto pb-0.5">
            {options.map((option, index) => (
              <motion.button
                key={option.id}
                type="button"
                onClick={() => onSelect(option.text)}
                disabled={disabled}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18, delay: index * 0.03 }}
                className="press-scale inline-flex max-w-[78vw] shrink-0 items-center rounded-[16px] border border-separator bg-[rgba(255,255,255,0.88)] px-3.5 py-2.5 text-left text-[12.5px] font-medium leading-5 text-label-secondary backdrop-blur-xl transition hover:bg-[rgba(255,255,255,0.96)] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[rgba(28,28,30,0.8)] dark:hover:bg-[rgba(32,32,36,0.92)] sm:max-w-[320px]"
              >
                <span className="line-clamp-2">{option.text}</span>
              </motion.button>
            ))}
            <button
              type="button"
              onClick={onClose}
              className="press-scale inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] border border-separator bg-[rgba(255,255,255,0.88)] text-label-tertiary backdrop-blur-xl transition hover:bg-[rgba(255,255,255,0.96)] dark:bg-[rgba(28,28,30,0.8)] dark:hover:bg-[rgba(32,32,36,0.92)]"
              aria-label="close quick replies"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
