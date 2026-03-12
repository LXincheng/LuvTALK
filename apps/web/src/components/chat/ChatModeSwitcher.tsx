import { Mic, Type, Radio } from 'lucide-react';
import { useLocale } from '../../providers/LocaleContext';

export type ChatMode = 'voice' | 'text' | 'immersive';

interface ChatModeSwitcherProps {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
  compact?: boolean;
}

export default function ChatModeSwitcher({
  mode,
  onChange,
  compact = false,
}: ChatModeSwitcherProps) {
  const { t } = useLocale();

  const modes: Array<{
    id: ChatMode;
    label: string;
    icon: typeof Mic;
    disabled: boolean;
    tooltip?: string;
  }> = [
    { id: 'voice', label: t('chatModeVoice'), icon: Mic, disabled: false },
    { id: 'text', label: t('chatModeText'), icon: Type, disabled: false },
    {
      id: 'immersive',
      label: t('chatModeImmersive'),
      icon: Radio,
      disabled: false,
    },
  ];

  return (
    <div className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto scrollbar-none border border-separator rounded-lg p-0.5 glass-card">
      {modes.map((m) => {
        const Icon = m.icon;
        const isActive = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => !m.disabled && onChange(m.id)}
            disabled={m.disabled}
            title={m.tooltip ?? m.label}
            className={`press-scale flex shrink-0 items-center justify-center gap-1 rounded-md transition-all duration-200 ${
              isActive
                ? 'glass-button text-white shadow-sm'
                : m.disabled
                  ? 'text-label-tertiary cursor-not-allowed opacity-50'
                  : 'text-label-secondary hover:bg-fill-secondary'
            } ${
              compact
                ? 'px-2 py-1.5'
                : 'px-2 py-1.5 lg:px-3 lg:py-1.5'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className={`${compact ? 'hidden' : 'hidden lg:inline'} text-xs font-medium`}>
              {m.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
