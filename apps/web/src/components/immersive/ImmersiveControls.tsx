import { MessageSquareText, Mic, MicOff, PhoneOff, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale } from '../../providers/LocaleContext';

interface ImmersiveControlsProps {
  isMuted: boolean;
  captionsEnabled: boolean;
  onToggleMute: () => void;
  onToggleCaptions: () => void;
  onEnd: () => void;
  onSettings: () => void;
  disabled?: boolean;
  settingsOpen?: boolean;
}

export default function ImmersiveControls({
  isMuted,
  captionsEnabled,
  onToggleMute,
  onToggleCaptions,
  onEnd,
  onSettings,
  disabled,
  settingsOpen,
}: ImmersiveControlsProps) {
  const { t } = useLocale();
  const MicIcon = isMuted ? MicOff : Mic;

  return (
    <div className="mx-auto inline-flex items-center justify-center gap-3 rounded-[28px] border border-black/5 bg-white/76 px-3 py-3 shadow-[0_14px_44px_rgba(15,23,42,0.06)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.06] dark:shadow-[0_18px_56px_rgba(2,8,20,0.28)]">
      <motion.button
        type="button"
        onClick={onToggleMute}
        disabled={disabled}
        whileTap={{ scale: 0.9 }}
        aria-label={isMuted ? t('immersiveUnmute') : t('immersiveMute')}
        className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all md:h-12 md:w-12 ${
          disabled
            ? 'cursor-not-allowed border-black/5 bg-black/[0.03] text-black/25 opacity-25 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-white/30'
            : isMuted
              ? 'border-rose-300/30 bg-rose-500/12 text-rose-600 hover:bg-rose-500/18 dark:text-rose-100'
              : 'border-black/6 bg-black/[0.025] text-slate-700 hover:bg-black/[0.04] dark:border-white/[0.10] dark:bg-white/[0.045] dark:text-white/72 dark:hover:bg-white/[0.08] dark:hover:text-white'
        }`}
      >
        <MicIcon className="w-5 h-5" />
      </motion.button>

      <motion.button
        type="button"
        onClick={onToggleCaptions}
        disabled={disabled}
        whileTap={{ scale: 0.9 }}
        aria-label={captionsEnabled ? t('immersiveCaptionsOff') : t('immersiveCaptionsOn')}
        className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all md:h-12 md:w-12 ${
          disabled
            ? 'cursor-not-allowed border-black/5 bg-black/[0.03] text-black/25 opacity-25 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-white/30'
            : captionsEnabled
              ? 'border-sky-300/30 bg-sky-500/12 text-sky-700 hover:bg-sky-500/18 dark:text-sky-100'
              : 'border-black/6 bg-black/[0.025] text-slate-700 hover:bg-black/[0.04] dark:border-white/[0.10] dark:bg-white/[0.045] dark:text-white/72 dark:hover:bg-white/[0.08] dark:hover:text-white'
        }`}
      >
        <MessageSquareText className="w-5 h-5" />
      </motion.button>

      <motion.button
        type="button"
        onClick={onEnd}
        whileTap={{ scale: 0.9 }}
        aria-label={t('immersiveEnd')}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-rose-300/35 bg-rose-500 text-white transition-all hover:bg-rose-600 md:h-14 md:w-14"
      >
        <PhoneOff className="w-5 h-5" />
      </motion.button>

      <motion.button
        type="button"
        onClick={onSettings}
        disabled={disabled}
        whileTap={{ scale: 0.9 }}
        aria-label={t('immersiveSettings')}
        className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all md:h-12 md:w-12 ${
          disabled
            ? 'cursor-not-allowed border-black/5 bg-black/[0.03] text-black/25 opacity-25 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-white/30'
            : settingsOpen
              ? 'border-black/8 bg-black/[0.05] text-slate-900 dark:border-white/[0.16] dark:bg-white/[0.10] dark:text-white'
              : 'border-black/6 bg-black/[0.025] text-slate-700 hover:bg-black/[0.04] dark:border-white/[0.10] dark:bg-white/[0.045] dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white'
        }`}
      >
        <Settings className="w-5 h-5" />
      </motion.button>
    </div>
  );
}
