import { Mic, Send } from 'lucide-react';

interface VoiceInputProps {
  value: string;
  isRecording: boolean;
  isSending?: boolean;
  isDisabled?: boolean;
  hideVoice?: boolean;
  placeholder?: string;
  recordingLabel?: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onToggleRecording: () => void;
}

export default function VoiceInput({
  value,
  isRecording,
  isSending = false,
  isDisabled = false,
  hideVoice = false,
  placeholder = 'Type a message or use the microphone...',
  recordingLabel = 'Recording...',
  onChange,
  onSend,
  onToggleRecording,
}: VoiceInputProps) {
  const disableInput = isDisabled || isSending;
  const disableSend = disableInput || isRecording || !value.trim();
  const disableToggle = isDisabled || (isSending && !isRecording);
  const buttonBaseClass =
    'shrink-0 h-11 w-11 rounded-xl border transition-all disabled:opacity-45 disabled:cursor-not-allowed';

  return (
    <div className="glass-card border-t border-slate-200 dark:border-slate-700 px-4 py-4">
      <div className="max-w-4xl mx-auto space-y-3">
        {isRecording && (
          <div className="relative overflow-hidden rounded-xl glass-status px-3 py-2 min-h-[2.5rem]">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-2/5 status-shimmer" />
            <div className="relative flex items-center gap-3">
              <div className="relative h-4 w-4 rounded-full border border-slate-300/75 dark:border-slate-500/70 bg-white/40 dark:bg-slate-700/40">
                <span className="absolute inset-[4px] rounded-full status-dot" />
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                {recordingLabel}
              </span>
              <WaveformAnimation />
            </div>
          </div>
        )}

        <div className="flex items-end gap-2 sm:gap-3">
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && onSend()}
            disabled={disableInput || isRecording}
            placeholder={placeholder}
            className="min-w-0 flex-1 px-3 sm:px-4 py-3 glass-input border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400/50 dark:focus:ring-slate-500/50 focus:border-transparent transition-all text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400"
          />
          {!hideVoice && (
            <button
              onClick={onToggleRecording}
              disabled={disableToggle}
              className={`${buttonBaseClass} ${
                isRecording
                  ? 'glass-status text-slate-700 dark:text-slate-200 border-slate-300/70 dark:border-slate-500/60'
                  : 'glass-status text-slate-700 dark:text-slate-200 border-slate-300/70 dark:border-slate-500/60 hover:bg-white/70 dark:hover:bg-slate-700/40'
              }`}
            >
              <Mic className="w-5 h-5 mx-auto" />
            </button>
          )}
          <button
            onClick={onSend}
            disabled={disableSend}
            className={`${buttonBaseClass} glass-status text-slate-700 dark:text-slate-200 border-slate-300/70 dark:border-slate-500/60 hover:bg-white/70 dark:hover:bg-slate-700/40`}
          >
            <Send className="w-5 h-5 mx-auto" />
          </button>
        </div>
      </div>
    </div>
  );
}

function WaveformAnimation() {
  return (
    <div className="record-bars ml-auto flex items-end gap-1">
      <span style={{ height: '9px' }} />
      <span style={{ height: '13px' }} />
      <span style={{ height: '11px' }} />
      <span style={{ height: '14px' }} />
      <span style={{ height: '10px' }} />
    </div>
  );
}
