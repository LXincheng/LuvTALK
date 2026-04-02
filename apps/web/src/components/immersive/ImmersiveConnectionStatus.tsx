import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import type { RealtimeStatus } from '../../hooks/useRealtimeSession';
import { useLocale } from '../../providers/LocaleContext';

interface ImmersiveConnectionStatusProps {
  status: RealtimeStatus;
  reconnectAttempt: number;
  reconnectMaxAttempts: number;
  nextRetryAt?: number;
}

export default function ImmersiveConnectionStatus({
  status,
  reconnectAttempt,
  reconnectMaxAttempts,
  nextRetryAt,
}: ImmersiveConnectionStatusProps) {
  const { t } = useLocale();
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (status !== 'reconnecting' || !nextRetryAt) {
      return;
    }
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => {
      window.clearInterval(timer);
    };
  }, [nextRetryAt, status]);

  const remainingSeconds = useMemo(() => {
    if (!nextRetryAt || status !== 'reconnecting') {
      return 0;
    }
    return Math.max(0, Math.ceil((nextRetryAt - now) / 1000));
  }, [nextRetryAt, now, status]);

  if (status !== 'connecting' && status !== 'reconnecting') {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="mt-3 inline-flex items-center gap-2.5 rounded-full border border-black/5 bg-white/72 px-3 py-1.5 text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-white/80"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-500 dark:text-cyan-200/90" />
      <span className="text-[11px]">
        {status === 'connecting'
          ? t('immersiveConnectingHint')
          : `${t('immersiveReconnecting')} #${Math.max(1, reconnectAttempt)}/${reconnectMaxAttempts} · ${remainingSeconds}s`}
      </span>
    </motion.div>
  );
}
