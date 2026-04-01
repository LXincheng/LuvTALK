import { useRef } from 'react';
import { ImagePlus, Mic, Send, X } from 'lucide-react';
import { IMAGE_UPLOAD_ACCEPT } from '../../utils/media';

interface VoiceInputProps {
  value: string;
  isRecording: boolean;
  isSending?: boolean;
  isDisabled?: boolean;
  hideVoice?: boolean;
  placeholder?: string;
  recordingLabel?: string;
  imagePreviewUrl?: string | null;
  imageButtonLabel?: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onToggleRecording: () => void;
  onImageFileSelect?: (file: File) => void;
  onClearImage?: () => void;
}

export default function VoiceInput({
  value,
  isRecording,
  isSending = false,
  isDisabled = false,
  hideVoice = false,
  placeholder = 'Type a message or use the microphone...',
  recordingLabel = 'Recording...',
  imagePreviewUrl,
  imageButtonLabel = 'Upload image',
  onChange,
  onSend,
  onToggleRecording,
  onImageFileSelect,
  onClearImage,
}: VoiceInputProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const disableInput = isDisabled || isSending;
  const disableSend = disableInput || isRecording || (!value.trim() && !imagePreviewUrl);
  const disableToggle = isDisabled || (isSending && !isRecording);
  const hasDraft = value.trim().length > 0 || Boolean(imagePreviewUrl);

  return (
    <div className="glass-sidebar border-t border-separator px-3 py-2 sm:px-4 sm:py-3 md:bg-[var(--surface-panel)]">
      <div className="max-w-4xl mx-auto space-y-2">
        {isRecording && (
          <div className="relative overflow-hidden rounded-xl glass-status px-3 py-1.5">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-2/5 status-shimmer" />
            <div className="relative flex items-center gap-2">
              <div className="relative h-3.5 w-3.5 rounded-full border border-separator bg-fill-secondary shrink-0">
                <span className="absolute inset-[3px] rounded-full status-dot" />
              </div>
              <span className="text-xs text-label font-medium">{recordingLabel}</span>
              <WaveformAnimation />
            </div>
          </div>
        )}

        {imagePreviewUrl ? (
          <div className="page-panel rounded-2xl p-2">
            <div className="relative inline-flex">
              <img
                src={imagePreviewUrl}
                alt="image draft"
                className="h-16 w-16 rounded-xl object-cover"
              />
              {onClearImage ? (
                <button
                  type="button"
                  onClick={onClearImage}
                  className="page-chip press-scale absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-surface/90 text-label-secondary transition-colors hover:bg-fill-secondary"
                  aria-label="Clear image"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          {onImageFileSelect ? (
            <>
              <input
                ref={imageInputRef}
                type="file"
                accept={IMAGE_UPLOAD_ACCEPT}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    onImageFileSelect(file);
                  }
                  event.currentTarget.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={disableInput}
                className="press-scale glass-card shrink-0 flex h-10 w-10 items-center justify-center rounded-xl border border-separator text-label-secondary transition-all hover:bg-fill-secondary disabled:cursor-not-allowed disabled:opacity-45"
                aria-label={imageButtonLabel}
                title={imageButtonLabel}
              >
                <ImagePlus className="w-4 h-4" />
              </button>
            </>
          ) : null}
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && onSend()}
            disabled={disableInput || isRecording}
            placeholder={placeholder}
            className="min-w-0 flex-1 px-3 py-2.5 glass-input border border-separator rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-transparent transition-all text-sm text-label placeholder:text-label-tertiary"
          />
          {!hideVoice && (
            <button
              onClick={onToggleRecording}
              disabled={disableToggle}
              className={`press-scale shrink-0 h-10 w-10 rounded-xl border transition-all disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center ${
                isRecording
                  ? 'bg-destructive/10 border-destructive/30 text-destructive animate-pulse'
                  : 'glass-card border-separator text-label-secondary hover:bg-fill-secondary'
              }`}
            >
              <Mic className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onSend}
            disabled={disableSend}
            className={`press-scale shrink-0 h-10 w-10 rounded-xl border transition-all disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center ${
              hasDraft && !disableSend
                ? 'glass-button border-transparent text-white'
                : 'glass-card border-separator text-label-secondary hover:bg-fill-secondary'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function WaveformAnimation() {
  return (
    <div className="record-bars ml-auto flex items-end gap-0.5">
      <span style={{ height: '8px' }} />
      <span style={{ height: '12px' }} />
      <span style={{ height: '10px' }} />
      <span style={{ height: '13px' }} />
      <span style={{ height: '9px' }} />
    </div>
  );
}
