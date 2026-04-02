import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquareText, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale } from '../../providers/LocaleContext';
import type { LocaleKey } from '../../providers/LocaleContext';
import { useRealtimeSession } from '../../hooks/useRealtimeSession';
import { REALTIME_VOICE_OPTIONS } from '../../constants/ui';
import { toast } from '../../utils/toast';
import AudioOrb from './AudioOrb';
import TranscriptSubtitles from './TranscriptSubtitles';
import ImmersiveControls from './ImmersiveControls';
import ImmersiveConnectionStatus from './ImmersiveConnectionStatus';
import VoiceStyleSelector from '../chat/VoiceStyleSelector';
import { REALTIME_SUBTITLE_LIMIT } from '../../constants/realtime';
import type { RealtimeErrorCode } from '../../types/realtime';

interface ImmersiveModeProps {
  conversationId: string;
  voice: string;
  onVoiceChange: (voice: string) => void;
  onExit: () => void;
  onFallbackToText?: () => void;
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
  voice,
  onVoiceChange,
  onExit,
  onFallbackToText,
}: ImmersiveModeProps) {
  const { t } = useLocale();
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
  } = useRealtimeSession({ conversationId, voice });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);

  const connectRef = useRef(connect);
  const disconnectRef = useRef(disconnect);
  useEffect(() => {
    connectRef.current = connect;
    disconnectRef.current = disconnect;
  }, [connect, disconnect]);

  const handleExit = useCallback(() => {
    disconnectRef.current('ended');
    onExit();
  }, [onExit]);

  useEffect(() => {
    void connectRef.current();
    return () => { disconnectRef.current('ended'); };
  }, []);

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
      className="fixed inset-0 z-50 flex select-none flex-col overflow-hidden bg-[radial-gradient(900px_420px_at_18%_-8%,rgba(203,213,225,0.32),transparent_56%),radial-gradient(720px_320px_at_84%_12%,rgba(191,219,254,0.22),transparent_58%),linear-gradient(180deg,#f7fbff_0%,#eef4fb_48%,#e9eff6_100%)] text-slate-900 dark:bg-[radial-gradient(960px_440px_at_18%_-10%,rgba(51,65,85,0.22),transparent_58%),radial-gradient(760px_320px_at_82%_12%,rgba(37,99,235,0.14),transparent_60%),linear-gradient(180deg,#050914_0%,#070b14_42%,#0b1020_100%)] dark:text-white"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[10%] top-[16%] h-52 w-52 rounded-full bg-slate-300/24 blur-3xl dark:bg-slate-500/8" />
        <div className="absolute bottom-[18%] right-[12%] h-64 w-64 rounded-full bg-blue-300/12 blur-3xl dark:bg-blue-500/8" />
      </div>

      <div className="relative z-10 flex items-center justify-between px-5 pt-5 safe-area-inset-top">
        <motion.button
          onClick={handleExit}
          whileTap={{ scale: 0.9 }}
          className="inline-flex h-10 items-center justify-center rounded-full border border-black/5 bg-white/72 px-3 text-slate-700 shadow-[0_8px_28px_rgba(15,23,42,0.06)] transition-colors hover:bg-white/84 hover:text-slate-950 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-white/72 dark:hover:bg-white/[0.10] dark:hover:text-white"
          aria-label={t('exitImmersive')}
        >
          <X className="w-4 h-4" />
        </motion.button>

        <div className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white/70 px-3 py-1.5 text-[11px] shadow-[0_8px_24px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.06]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="font-medium text-slate-700 dark:text-white/82">{t('immersiveMode')}</span>
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
            className="text-[13px] font-medium tracking-wide text-slate-600 dark:text-white/74"
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
              className="mt-3 rounded-full border border-black/6 bg-white/72 px-5 py-1.5 text-[12px] text-slate-700 transition-all backdrop-blur-xl hover:bg-white/84 dark:border-white/[0.10] dark:bg-white/[0.08] dark:text-white/86 dark:hover:bg-white/[0.12]"
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
              className="mt-2 rounded-full border border-black/6 bg-white/68 px-5 py-1.5 text-[12px] text-slate-700 transition-all backdrop-blur-xl hover:bg-white/82 dark:border-white/[0.10] dark:bg-white/[0.06] dark:text-white/76 dark:hover:bg-white/[0.10]"
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
              className="rounded-[30px] border border-black/5 bg-white/72 px-4 py-4 shadow-[0_18px_56px_rgba(15,23,42,0.06)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.74),rgba(2,6,23,0.62))] dark:shadow-[0_20px_64px_rgba(2,8,20,0.36)]"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-white/44">
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

        <AnimatePresence>
          {settingsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-[28px] border border-black/5 bg-white/72 px-4 py-4 shadow-[0_16px_48px_rgba(15,23,42,0.05)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.74),rgba(2,6,23,0.62))] dark:shadow-[0_18px_56px_rgba(2,8,20,0.34)]">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-white/44">
                  {t('immersiveSettingsHint')}
                </p>
                <VoiceStyleSelector
                  value={voice}
                  onChange={onVoiceChange}
                  options={REALTIME_VOICE_OPTIONS}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ImmersiveControls
          isMuted={isMuted}
          captionsEnabled={captionsEnabled}
          onToggleMute={toggleMute}
          onToggleCaptions={() => setCaptionsEnabled((prev) => !prev)}
          onEnd={handleExit}
          onSettings={() => setSettingsOpen((prev) => !prev)}
          disabled={controlsDisabled}
          settingsOpen={settingsOpen}
        />
      </div>
    </motion.div>
  );
}
