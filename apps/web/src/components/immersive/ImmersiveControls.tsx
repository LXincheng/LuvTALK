import { Mic, MicOff, PhoneOff, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale } from '../../providers/LocaleContext';

interface ImmersiveControlsProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onEnd: () => void;
  onSettings: () => void;
  disabled?: boolean;
  settingsOpen?: boolean;
}

export default function ImmersiveControls({
  isMuted,
  onToggleMute,
  onEnd,
  onSettings,
  disabled,
  settingsOpen,
}: ImmersiveControlsProps) {
  const { t } = useLocale();
  const MicIcon = isMuted ? MicOff : Mic;

  return (
    <div className="mx-auto inline-flex items-center justify-center gap-4 rounded-[22px] border border-white/[0.14] bg-white/[0.06] px-4 py-3 backdrop-blur-2xl shadow-[0_16px_44px_rgba(0,8,18,0.38)]">
      {/* Mic */}
      <motion.button
        type="button"
        onClick={onToggleMute}
        disabled={disabled}
        whileTap={{ scale: 0.9 }}
        aria-label={isMuted ? t('immersiveUnmute') : t('immersiveMute')}
        className={`w-11 h-11 md:w-12 md:h-12 flex items-center justify-center rounded-full border transition-all ${
          disabled
            ? 'opacity-25 cursor-not-allowed border-white/[0.06] bg-white/[0.04] text-white/30'
            : isMuted
              ? 'bg-rose-500/22 border-rose-300/20 text-rose-100 hover:bg-rose-500/32'
              : 'bg-white/[0.05] border-white/[0.16] text-white/70 hover:bg-white/[0.1] hover:text-white'
        }`}
      >
        <MicIcon className="w-5 h-5" />
      </motion.button>

      {/* End call */}
      <motion.button
        type="button"
        onClick={onEnd}
        whileTap={{ scale: 0.9 }}
        aria-label={t('immersiveEnd')}
        className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full border border-rose-300/28 bg-rose-500/78 text-white hover:bg-rose-500 transition-all shadow-[0_8px_28px_rgba(244,63,94,0.35)]"
      >
        <PhoneOff className="w-5 h-5" />
      </motion.button>

      {/* Settings */}
      <motion.button
        type="button"
        onClick={onSettings}
        disabled={disabled}
        whileTap={{ scale: 0.9 }}
        aria-label={t('immersiveSettings')}
        className={`w-11 h-11 md:w-12 md:h-12 flex items-center justify-center rounded-full border transition-all ${
          disabled
            ? 'opacity-25 cursor-not-allowed border-white/[0.06] bg-white/[0.04] text-white/30'
            : settingsOpen
              ? 'bg-white/[0.12] border-white/[0.24] text-white'
              : 'bg-white/[0.05] border-white/[0.16] text-white/60 hover:bg-white/[0.1] hover:text-white'
        }`}
      >
        <Settings className="w-5 h-5" />
      </motion.button>
    </div>
  );
}
