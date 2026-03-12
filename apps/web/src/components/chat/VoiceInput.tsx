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
  const hasDraft = value.trim().length > 0;

  return (
    <div className="glass-card border-t border-separator px-4 py-4">
      <div className="max-w-4xl mx-auto space-y-3">
        {isRecording && (
          <div className="relative overflow-hidden rounded-xl glass-status px-3 py-2 min-h-[2.5rem]">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-2/5 status-shimmer" />
            <div className="relative flex items-center gap-3">
              <div className="relative h-4 w-4 rounded-full border border-separator bg-fill-secondary">
                <span className="absolute inset-[4px] rounded-full status-dot" />
              </div>
              <span className="text-sm text-label font-medium">
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
            className="min-w-0 flex-1 px-3 sm:px-4 py-3 glass-input border border-separator rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-transparent transition-all text-label placeholder:text-label-tertiary"
          />
          {!hideVoice && (
            <button
              onClick={onToggleRecording}
              disabled={disableToggle}
              className={`press-scale shrink-0 h-11 w-11 rounded-xl border transition-all disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center ${
                isRecording
                  ? 'bg-destructive/10 border-destructive/30 text-destructive animate-pulse'
                  : 'glass-card border-separator text-label-secondary hover:bg-fill-secondary'
              }`}
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={onSend}
            disabled={disableSend}
            className={`press-scale shrink-0 h-11 w-11 rounded-xl border transition-all disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center ${
              hasDraft && !disableSend
                ? 'glass-button border-transparent text-white'
                : 'glass-card border-separator text-label-secondary hover:bg-fill-secondary'
            }`}
          >
            <Send className="w-5 h-5" />
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
