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
    <div className="flex items-center justify-center gap-6">
      {/* Mic */}
      <motion.button
        type="button"
        onClick={onToggleMute}
        disabled={disabled}
        whileTap={{ scale: 0.9 }}
        aria-label={isMuted ? t('immersiveUnmute') : t('immersiveMute')}
        className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
          disabled
            ? 'opacity-20 cursor-not-allowed'
            : isMuted
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-white/[0.06] text-white/50 hover:bg-white/[0.1] hover:text-white/70'
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
        className="w-14 h-14 flex items-center justify-center rounded-full bg-red-500/80 text-white hover:bg-red-500 transition-all"
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
        className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
          disabled
            ? 'opacity-20 cursor-not-allowed'
            : settingsOpen
              ? 'bg-white/[0.1] text-white/70'
              : 'bg-white/[0.06] text-white/30 hover:bg-white/[0.1] hover:text-white/50'
        }`}
      >
        <Settings className="w-5 h-5" />
      </motion.button>
    </div>
  );
}
