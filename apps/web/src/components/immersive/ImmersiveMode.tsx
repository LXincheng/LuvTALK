import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale } from '../../providers/LocaleContext';
import type { LocaleKey } from '../../providers/LocaleContext';
import { useRealtimeSession } from '../../hooks/useRealtimeSession';
import AudioOrb from './AudioOrb';
import TranscriptSubtitles from './TranscriptSubtitles';
import ImmersiveControls from './ImmersiveControls';
import VoiceStyleSelector from '../chat/VoiceStyleSelector';
import { REALTIME_SUBTITLE_LIMIT } from '../../constants/realtime';
import type { RealtimeErrorCode } from '../../types/realtime';

interface ImmersiveModeProps {
  conversationId: string;
  voice: string;
  onVoiceChange: (voice: string) => void;
  onExit: () => void;
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
  };
  return map[code] ?? t('immersiveErrorConnect');
};

export default function ImmersiveMode({
  conversationId,
  voice,
  onVoiceChange,
  onExit,
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
    connect,
    disconnect,
    toggleMute,
  } = useRealtimeSession({ conversationId, voice });

  const [settingsOpen, setSettingsOpen] = useState(false);

  const connectRef = useRef(connect);
  const disconnectRef = useRef(disconnect);
  connectRef.current = connect;
  disconnectRef.current = disconnect;

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

  const controlsDisabled = status === 'connecting' || status === 'reconnecting';
  const showReconnect = status === 'error' || status === 'ended';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden select-none"
      style={{ background: '#000' }}
    >
      {/* Full-screen layout: top status, center orb, bottom transcript + controls */}

      {/* Top area — close button + error */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5 safe-area-inset-top">
        <motion.button
          onClick={handleExit}
          whileTap={{ scale: 0.9 }}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.07] text-white/50 hover:text-white/80 transition-colors"
          aria-label={t('exitImmersive')}
        >
          <X className="w-4 h-4" />
        </motion.button>

        <AnimatePresence>
          {errorMessage && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[11px] text-red-400/70"
            >
              {errorMessage}
            </motion.span>
          )}
        </AnimatePresence>
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
            className="text-[13px] text-white/30 font-light tracking-wide"
          >
            {statusLabel}
          </motion.p>

          <AnimatePresence>
            {controlsDisabled && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 1.5, duration: 0.4 }}
                className="text-[11px] text-white/15"
              >
                {t('immersiveConnectingHint')}
              </motion.p>
            )}
          </AnimatePresence>

          {showReconnect && (
            <motion.button
              type="button"
              onClick={() => void connect()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileTap={{ scale: 0.96 }}
              className="mt-3 px-5 py-1.5 rounded-full text-[12px] text-white/50 border border-white/[0.08] hover:border-white/15 hover:text-white/70 transition-all"
            >
              {t('immersiveReconnect')}
            </motion.button>
          )}
        </div>
      </div>

      {/* Bottom — transcript + controls */}
      <div className="relative z-10 flex flex-col gap-4 px-5 pb-10 safe-area-inset-bottom">
        <TranscriptSubtitles
          entries={fullTranscript}
          activeUserText={userTranscript}
          activeAiText={aiTranscript}
          maxItems={REALTIME_SUBTITLE_LIMIT}
        />

        <AnimatePresence>
          {settingsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-center overflow-hidden"
            >
              <div className="px-4 py-2 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
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
