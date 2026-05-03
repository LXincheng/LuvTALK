import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquareText, Volume2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale } from '../../providers/LocaleContext';
import type { LocaleKey } from '../../providers/LocaleContext';
import { useRealtimeSession } from '../../hooks/useRealtimeSession';
import { toast } from '../../utils/toast';
import AudioOrb from './AudioOrb';
import TranscriptSubtitles from './TranscriptSubtitles';
import ImmersiveControls from './ImmersiveControls';
import ImmersiveConnectionStatus from './ImmersiveConnectionStatus';
import { REALTIME_SUBTITLE_LIMIT } from '../../constants/realtime';
import { getDefaultImmersiveVoice, getRealtimeVoiceOptions } from '../../config/voice';
import type { LanguageCode } from '../../types/api';
import type { RealtimeErrorCode } from '../../types/realtime';

interface ImmersiveModeProps {
  conversationId: string;
  targetLanguage: LanguageCode;
  voice: string;
  onExit: () => void;
  onFallbackToText?: () => void;
  onVoiceChange?: (voice: string) => void;
}

const resolveErrorMessage = (
  code: RealtimeErrorCode | undefined,
  t: (key: LocaleKey) => string,
) => {
  if (!code) return '';
  const map: Record<RealtimeErrorCode, string> = {
    UNSUPPORTED: t('immersiveErrorUnsupported'),
    TOKEN_FAILED: t('immersiveErrorToken'),
    CONNECT_FAILED: t('immersiveErrorConnect'),
    MEDIA_DENIED: t('immersiveErrorMic'),
    SAVE_FAILED: t('immersiveErrorSave'),
    TAKEN_OVER: t('immersiveErrorTakenOver'),
    PERMISSION_DENIED: t('immersiveErrorPermission'),
    SESSION_EXPIRED: t('immersiveErrorSessionExpired'),
    RATE_LIMITED: t('immersiveErrorRateLimited'),
    SERVICE_UNAVAILABLE: t('immersiveErrorServiceUnavailable'),
    INVALID_REQUEST: t('immersiveErrorInvalidRequest'),
  };
  return map[code] ?? t('immersiveErrorConnect');
};

export default function ImmersiveMode({
  conversationId,
  targetLanguage,
  voice,
  onExit,
  onFallbackToText,
  onVoiceChange,
}: ImmersiveModeProps) {
  const { t } = useLocale();
  const [selectedVoice, setSelectedVoice] = useState(voice);
  const {
    status,
    isMuted,
    isAiSpeaking,
    userTranscript,
    aiTranscript,
    fullTranscript,
    audioLevel,
    lastError,
    reconnectAttempt,
    reconnectMaxAttempts,
    nextRetryAt,
    connect,
    disconnect,
    toggleMute,
  } = useRealtimeSession({ conversationId, targetLanguage, voice: selectedVoice });

  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const voiceOptions = useMemo(
    () => getRealtimeVoiceOptions(targetLanguage),
    [targetLanguage],
  );

  const connectRef = useRef(connect);
  const disconnectRef = useRef(disconnect);
  useEffect(() => {
    connectRef.current = connect;
    disconnectRef.current = disconnect;
  }, [connect, disconnect]);

  useEffect(() => {
    setSelectedVoice(voice);
  }, [voice]);

  const handleVoiceChange = useCallback((nextVoice: string) => {
    setSelectedVoice(nextVoice);
    onVoiceChange?.(nextVoice);
  }, [onVoiceChange]);

  useEffect(() => {
    if (voiceOptions.some((option) => option.id === selectedVoice)) {
      return;
    }
    handleVoiceChange(getDefaultImmersiveVoice(targetLanguage));
  }, [handleVoiceChange, selectedVoice, targetLanguage, voiceOptions]);

  const handleExit = useCallback(() => {
    disconnectRef.current('ended');
    onExit();
  }, [onExit]);

  useEffect(() => {
    void connectRef.current();
    return () => { disconnectRef.current('ended'); };
  }, [conversationId]);

  const statusLabel = useMemo(() => {
    if (status === 'connecting') return t('immersiveConnecting');
    if (status === 'reconnecting') return t('immersiveReconnecting');
    if (status === 'error' || status === 'ended') return t('immersiveDisconnected');
    if (isAiSpeaking) return t('immersiveSpeaking');
    if (isMuted) return t('immersiveMuted');
    return t('immersiveListening');
  }, [isAiSpeaking, isMuted, status, t]);

  const errorMessage = useMemo(
    () => resolveErrorMessage(lastError, t),
    [lastError, t],
  );

  useEffect(() => {
    if (errorMessage) {
      toast.error(errorMessage, { id: 'immersive-status' });
      return;
    }
    toast.dismiss('immersive-status');
  }, [errorMessage]);

  useEffect(() => {
    return () => {
      toast.dismiss('immersive-status');
    };
  }, []);

  const controlsDisabled = status === 'connecting' || status === 'reconnecting';
  const showReconnect = status === 'error' || status === 'ended';
  const reconnectBlocked =
    lastError === 'PERMISSION_DENIED' ||
    lastError === 'SESSION_EXPIRED' ||
    lastError === 'INVALID_REQUEST';
  const canReconnect = showReconnect && !reconnectBlocked;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-50 flex select-none flex-col overflow-hidden bg-[radial-gradient(760px_360px_at_50%_12%,rgba(125,211,252,0.14),transparent_44%),radial-gradient(860px_420px_at_50%_106%,rgba(10,132,255,0.12),transparent_54%),linear-gradient(180deg,#010409_0%,#030711_50%,#030914_100%)] text-white"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.018),transparent_58%)]" />
        <motion.div
          className="absolute left-1/2 top-[18%] h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-cyan-200/[0.035] blur-[118px]"
          animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.82, 0.5] }}
          transition={{ duration: 9.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute left-1/2 top-[58%] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-blue-500/[0.055] blur-[126px]"
          animate={{ scale: [1.02, 0.96, 1.02], opacity: [0.56, 0.9, 0.56] }}
          transition={{ duration: 10.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10 flex items-center justify-between px-5 pt-5 safe-area-inset-top">
        <motion.button
          onClick={handleExit}
          whileTap={{ scale: 0.9 }}
          className="inline-flex h-10 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.04] px-3 text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white backdrop-blur-xl"
          aria-label={t('exitImmersive')}
        >
          <X className="w-4 h-4" />
        </motion.button>

        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-[11px] backdrop-blur-xl">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.85)]" />
          <span className="font-medium text-white/84">{t('immersiveMode')}</span>
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-5">
        <AudioOrb level={audioLevel} status={status} isAiSpeaking={isAiSpeaking} />

        <div className="mt-6 flex flex-col items-center gap-1">
          <motion.p
            key={statusLabel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="text-[13px] font-medium tracking-[0.08em] text-white/62"
          >
            {statusLabel}
          </motion.p>

          <AnimatePresence>
            <ImmersiveConnectionStatus
              status={status}
              reconnectAttempt={reconnectAttempt}
              reconnectMaxAttempts={reconnectMaxAttempts}
              nextRetryAt={nextRetryAt}
            />
          </AnimatePresence>

          {canReconnect && (
            <motion.button
              type="button"
              onClick={() => void connect()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileTap={{ scale: 0.96 }}
              className="mt-3 rounded-full border border-white/[0.08] bg-white/[0.05] px-5 py-1.5 text-[12px] text-white/88 transition-all backdrop-blur-xl hover:bg-white/[0.09]"
            >
              {t('immersiveReconnect')}
            </motion.button>
          )}
          {showReconnect && onFallbackToText && (
            <motion.button
              type="button"
              onClick={onFallbackToText}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileTap={{ scale: 0.96 }}
              className="mt-2 rounded-full border border-white/[0.07] bg-white/[0.04] px-5 py-1.5 text-[12px] text-white/76 transition-all backdrop-blur-xl hover:bg-white/[0.08]"
            >
              {t('immersiveBackToText')}
            </motion.button>
          )}
        </div>

      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 pb-8 safe-area-inset-bottom">
        <AnimatePresence initial={false}>
          {captionsEnabled ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="rounded-[26px] border border-white/[0.055] bg-white/[0.035] px-3 py-3 backdrop-blur-2xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
                  <MessageSquareText className="h-3.5 w-3.5" />
                  <span>{t('immersiveCaptions')}</span>
                </div>
              </div>
              <TranscriptSubtitles
                entries={fullTranscript}
                activeUserText={userTranscript}
                activeAiText={aiTranscript}
                maxItems={REALTIME_SUBTITLE_LIMIT}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div
          className="mx-auto flex max-w-full items-center gap-2 overflow-x-auto rounded-full border border-white/[0.06] bg-white/[0.04] px-2 py-2 backdrop-blur-2xl scrollbar-none"
          aria-label={t('immersiveVoice')}
        >
          <Volume2 className="ml-1 h-4 w-4 shrink-0 text-white/48" />
          {voiceOptions.map((option) => {
            const active = option.id === selectedVoice;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleVoiceChange(option.id)}
                disabled={controlsDisabled}
                title={option.descriptionKey ? t(option.descriptionKey) : option.description}
                className={`h-8 shrink-0 rounded-full px-3 text-[12px] font-medium transition-colors ${
                  active
                    ? 'bg-white text-slate-950'
                    : 'bg-white/[0.04] text-white/66 hover:bg-white/[0.08] hover:text-white'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {option.labelKey ? t(option.labelKey) : (option.label ?? option.id)}
              </button>
            );
          })}
        </div>

        <ImmersiveControls
          isMuted={isMuted}
          captionsEnabled={captionsEnabled}
          onToggleMute={toggleMute}
          onToggleCaptions={() => setCaptionsEnabled((prev) => !prev)}
          onEnd={handleExit}
          disabled={controlsDisabled}
        />
      </div>
    </motion.div>
  );
}
