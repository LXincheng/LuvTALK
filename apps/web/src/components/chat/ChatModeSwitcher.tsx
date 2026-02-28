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
    <div className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto scrollbar-none border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-white/60 dark:bg-slate-900/60">
      {modes.map((m) => {
        const Icon = m.icon;
        const isActive = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => !m.disabled && onChange(m.id)}
            disabled={m.disabled}
            title={m.tooltip ?? m.label}
            className={`flex shrink-0 items-center justify-center gap-1 rounded-md transition-all ${
              isActive
                ? 'glass-button text-white'
                : m.disabled
                  ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
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
