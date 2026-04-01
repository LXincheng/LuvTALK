import { Gauge } from 'lucide-react';
import { TTS_SPEED_OPTIONS } from '../../constants/ui';
import { useLocale } from '../../providers/LocaleContext';
import type { LocaleKey } from '../../providers/LocaleContext';

type VoiceSpeed = (typeof TTS_SPEED_OPTIONS)[number]['id'];

interface VoiceSpeedSelectorProps {
  value: VoiceSpeed;
  onChange: (speed: VoiceSpeed) => void;
  compact?: boolean;
}

export default function VoiceSpeedSelector({
  value,
  onChange,
  compact = false,
}: VoiceSpeedSelectorProps) {
  const { t } = useLocale();

  return (
    <div className="page-panel inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg p-0.5 scrollbar-none">
      <Gauge className="ml-1.5 h-3.5 w-3.5 shrink-0 text-label-tertiary" />
      {TTS_SPEED_OPTIONS.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`press-scale shrink-0 rounded-md text-xs font-medium transition-all duration-200 ${
              isActive
                ? 'glass-button text-white shadow-sm'
                : 'text-label-secondary hover:bg-fill-secondary'
            } ${compact ? 'px-2 py-1.5' : 'px-2 py-1.5 lg:px-2.5'}`}
          >
            {t(opt.labelKey as LocaleKey)}
          </button>
        );
      })}
    </div>
  );
}
