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

  return (
    <div className="glass-card border-t border-slate-200 dark:border-slate-700 px-4 py-4">
      <div className="max-w-4xl mx-auto space-y-3">
        {isRecording && (
          <div className="flex items-center gap-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 px-3 py-2 border border-indigo-100/70 dark:border-indigo-900/40">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm text-indigo-900 dark:text-indigo-300 font-medium">
              {recordingLabel}
            </span>
            <WaveformAnimation />
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
            className="min-w-0 flex-1 px-3 sm:px-4 py-3 glass-input border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-all text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400"
          />
          {!hideVoice && (
            <button
              onClick={onToggleRecording}
              disabled={disableToggle}
              className={`shrink-0 p-2.5 sm:p-3 rounded-xl transition-all ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'glass-button text-white hover:opacity-90'
              }`}
            >
              <Mic className="w-6 h-6" />
            </button>
          )}
          <button
            onClick={onSend}
            disabled={disableSend}
            className="shrink-0 p-2.5 sm:p-3 glass-button disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all hover:opacity-90"
          >
            <Send className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

function WaveformAnimation() {
  const waveformHeights = [12, 20, 14, 22, 16];

  return (
    <div className="flex items-center gap-1 ml-auto">
      {waveformHeights.map((height, index) => (
        <div
          key={index}
          className="w-1 bg-indigo-600 rounded-full animate-pulse"
          style={{
            height: `${height}px`,
            animationDelay: `${index * 0.1}s`,
            animationDuration: '0.8s',
          }}
        />
      ))}
    </div>
  );
}
