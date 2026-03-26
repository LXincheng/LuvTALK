import { AnimatePresence, motion } from 'motion/react';
import { MessageCircleMore, X } from 'lucide-react';

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
                className="press-scale inline-flex max-w-[78vw] shrink-0 items-center gap-1.5 rounded-[16px] border border-[rgba(124,151,192,0.18)] bg-[rgba(255,255,255,0.9)] px-3 py-2 text-left text-[12px] font-medium leading-5 text-label-secondary shadow-[0_10px_24px_rgba(61,88,135,0.12)] backdrop-blur-xl transition hover:border-primary/20 hover:bg-[rgba(255,255,255,0.98)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[rgba(28,28,30,0.84)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.28)] sm:max-w-[320px]"
              >
                <MessageCircleMore className="h-3.5 w-3.5 shrink-0 text-primary/85" />
                <span className="line-clamp-2">{option.text}</span>
              </motion.button>
            ))}
            <button
              type="button"
              onClick={onClose}
              className="press-scale inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[15px] border border-[rgba(124,151,192,0.18)] bg-[rgba(255,255,255,0.9)] text-label-tertiary shadow-[0_10px_24px_rgba(61,88,135,0.12)] backdrop-blur-xl transition hover:bg-[rgba(255,255,255,0.98)] dark:border-white/10 dark:bg-[rgba(28,28,30,0.84)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.28)]"
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
