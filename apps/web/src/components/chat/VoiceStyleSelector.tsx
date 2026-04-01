import { Volume2 } from 'lucide-react';
import { useLocale } from '../../providers/LocaleContext';
import type { LocaleKey } from '../../providers/LocaleContext';

type VoiceOption = {
  id: string;
  labelKey?: LocaleKey;
  label?: string;
  descriptionKey?: LocaleKey;
  description?: string;
};

interface VoiceStyleSelectorProps {
  value: string;
  onChange: (voice: string) => void;
  compact?: boolean;
  options?: readonly VoiceOption[];
  disabled?: boolean;
}

export default function VoiceStyleSelector({
  value,
  onChange,
  compact = false,
  options = [],
  disabled = false,
}: VoiceStyleSelectorProps) {
  const { t } = useLocale();

  return (
    <div className="page-panel inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg p-0.5 scrollbar-none">
      <Volume2 className="w-3.5 h-3.5 text-label-tertiary ml-1.5 shrink-0" />
      {options.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            disabled={disabled}
            title={opt.descriptionKey ? t(opt.descriptionKey) : opt.description}
            className={`press-scale shrink-0 rounded-md text-xs font-medium transition-all duration-200 ${
              isActive
                ? 'glass-button text-white shadow-sm'
                : 'text-label-secondary hover:bg-fill-secondary'
            } ${compact ? 'px-2 py-1.5' : 'px-2 py-1.5 lg:px-2.5'} disabled:cursor-not-allowed disabled:opacity-45`}
          >
            {opt.labelKey ? t(opt.labelKey) : (opt.label ?? opt.id)}
          </button>
        );
      })}
    </div>
  );
}
