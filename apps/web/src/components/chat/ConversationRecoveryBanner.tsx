import { Loader2, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale } from '../../providers/LocaleContext';

export type ConversationRecoveryState = 'initializing' | 'recovering' | 'error';

interface ConversationRecoveryBannerProps {
  state: ConversationRecoveryState;
  message: string;
  onRetry?: () => void;
}

export default function ConversationRecoveryBanner({
  state,
  message,
  onRetry,
}: ConversationRecoveryBannerProps) {
  const { t } = useLocale();
  const isLoading = state === 'initializing' || state === 'recovering';
  const isError = state === 'error';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mx-4 mt-3 rounded-2xl border border-slate-200/70 bg-white/80 px-3 py-2.5 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/70"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-500" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-rose-400" />
          )}
          <span>{message}</span>
        </div>
        {isError && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 rounded-full border border-slate-300/80 bg-white/70 px-2.5 py-1 text-[11px] text-slate-700 transition-colors hover:bg-white dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-100"
          >
            <RotateCcw className="h-3 w-3" />
            {t('commonRetry')}
          </button>
        )}
      </div>
    </motion.div>
  );
}
