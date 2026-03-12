import { Volume2 } from 'lucide-react';
import { TTS_VOICE_OPTIONS } from '../../constants/ui';
import { useLocale } from '../../providers/LocaleContext';
import type { LocaleKey } from '../../providers/LocaleContext';

interface VoiceStyleSelectorProps {
  value: string;
  onChange: (voice: string) => void;
  compact?: boolean;
}

export default function VoiceStyleSelector({
  value,
  onChange,
  compact = false,
}: VoiceStyleSelectorProps) {
  const { t } = useLocale();

  return (
    <div className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto scrollbar-none border border-separator rounded-lg p-0.5 glass-card">
      <Volume2 className="w-3.5 h-3.5 text-label-tertiary ml-1.5 shrink-0" />
      {TTS_VOICE_OPTIONS.map((opt) => {
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
