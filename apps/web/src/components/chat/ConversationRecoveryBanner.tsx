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
      className="mx-4 mt-3 rounded-2xl border border-separator glass-card px-3 py-2.5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs text-label-secondary">
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
            className="inline-flex items-center gap-1 rounded-full border border-separator glass-card px-2.5 py-1 text-[11px] text-label transition-colors hover:bg-fill-secondary"
          >
            <RotateCcw className="h-3 w-3" />
            {t('commonRetry')}
          </button>
        )}
      </div>
    </motion.div>
  );
}
