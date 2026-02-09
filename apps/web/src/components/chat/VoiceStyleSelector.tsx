import { Volume2 } from 'lucide-react';
import { TTS_VOICE_OPTIONS } from '../../constants/ui';
import { useLocale } from '../../providers/LocaleContext';
import type { LocaleKey } from '../../providers/LocaleContext';

interface VoiceStyleSelectorProps {
  value: string;
  onChange: (voice: string) => void;
}

export default function VoiceStyleSelector({
  value,
  onChange,
}: VoiceStyleSelectorProps) {
  const { t } = useLocale();

  return (
    <div className="inline-flex items-center gap-0.5 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-white/60 dark:bg-slate-900/60">
      <Volume2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 ml-1.5 shrink-0" />
      {TTS_VOICE_OPTIONS.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              isActive
                ? 'glass-button text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t(opt.labelKey as LocaleKey)}
          </button>
        );
      })}
    </div>
  );
}
