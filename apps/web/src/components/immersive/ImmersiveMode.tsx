import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { useLocale } from '../../providers/LocaleContext';
import type { LocaleKey } from '../../providers/LocaleContext';
import { useRealtimeSession } from '../../hooks/useRealtimeSession';
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
      className="fixed inset-0 z-50 flex flex-col overflow-hidden select-none"
      style={{
        background:
          'radial-gradient(1200px 520px at 15% -10%, rgba(45,65,125,0.42), transparent 62%), radial-gradient(900px 420px at 88% 8%, rgba(24,122,126,0.28), transparent 58%), linear-gradient(180deg, #070912 0%, #04050b 52%, #03040a 100%)',
      }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-[9%] top-[18%] w-56 h-56 rounded-full bg-cyan-400/8 blur-3xl" />
        <div className="absolute right-[6%] bottom-[20%] w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      {/* Top area */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5 safe-area-inset-top">
        <motion.button
          onClick={handleExit}
          whileTap={{ scale: 0.9 }}
          className="h-9 px-3 inline-flex items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.14] text-white/75 hover:bg-white/[0.12] hover:text-white transition-colors backdrop-blur-xl"
          aria-label={t('exitImmersive')}
        >
          <X className="w-4 h-4" />
        </motion.button>

        <span className="text-[11px] px-3 py-1 rounded-full text-white/65 bg-white/[0.05] border border-white/[0.08] backdrop-blur-xl">
          {t('immersiveMode')}
        </span>
      </div>

      {/* Center — orb + status label */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-0">
        <AudioOrb level={audioLevel} status={status} isAiSpeaking={isAiSpeaking} />

        <div className="mt-6 flex flex-col items-center gap-1">
          <motion.p
            key={statusLabel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="text-[13px] text-white/70 font-medium tracking-wide"
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
              className="mt-3 px-5 py-1.5 rounded-full text-[12px] text-white bg-white/[0.12] border border-white/[0.22] hover:bg-white/[0.16] transition-all backdrop-blur-xl"
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
              className="mt-2 px-5 py-1.5 rounded-full text-[12px] text-white/85 bg-slate-900/35 border border-white/[0.14] hover:bg-slate-900/45 transition-all backdrop-blur-xl"
            >
              {t('immersiveBackToText')}
            </motion.button>
          )}
        </div>
      </div>

      {/* Bottom — transcript + controls */}
      <div className="relative z-10 flex flex-col gap-4 px-5 pb-10 safe-area-inset-bottom max-w-2xl w-full mx-auto">
        <div className="rounded-3xl border border-white/[0.14] bg-white/[0.06] backdrop-blur-2xl px-4 py-3 shadow-[0_22px_70px_rgba(1,8,20,0.46)]">
          <TranscriptSubtitles
            entries={fullTranscript}
            activeUserText={userTranscript}
            activeAiText={aiTranscript}
            maxItems={REALTIME_SUBTITLE_LIMIT}
          />
        </div>

        <AnimatePresence>
          {settingsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-center overflow-hidden"
            >
              <div className="px-4 py-2 rounded-2xl bg-white/[0.08] border border-white/[0.16] backdrop-blur-2xl">
                <VoiceStyleSelector value={voice} onChange={onVoiceChange} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ImmersiveControls
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onEnd={handleExit}
          onSettings={() => setSettingsOpen((prev) => !prev)}
          disabled={controlsDisabled}
          settingsOpen={settingsOpen}
        />
      </div>
    </motion.div>
  );
}
