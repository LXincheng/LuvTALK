import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  REALTIME_AI_SPEAKING_TIMEOUT_MS,
  REALTIME_AUDIO_BUFFER_SIZE,
  REALTIME_AUDIO_SAMPLE_RATE,
  REALTIME_CONNECT_TIMEOUT_MS,
  REALTIME_LOCK_PREFIX,
  REALTIME_RECONNECT_DELAY_MS,
  REALTIME_RECONNECT_MAX_ATTEMPTS,
  REALTIME_TRANSCRIPT_THROTTLE_MS,
  REALTIME_VISIBILITY_TIMEOUT_MS,
  REALTIME_WS_PATH,
} from '../constants/realtime';
import { getAccessToken } from '../services/authService';
import { API_BASE_URL } from '../services/apiClient';
import { saveRealtimeTranscript } from '../services/realtimeService';
import type {
  RealtimeErrorCode,
  RealtimeServerErrorCode,
  RealtimeTranscriptEntry,
} from '../types/realtime';

export type RealtimeStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'ended'
  | 'error';

interface UseRealtimeSessionOptions {
  conversationId: string;
  voice?: string;
}

export function useRealtimeSession({ conversationId, voice }: UseRealtimeSessionOptions) {
  const [status, setStatus] = useState<RealtimeStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [userTranscript, setUserTranscript] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  const [fullTranscript, setFullTranscript] = useState<RealtimeTranscriptEntry[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [lastError, setLastError] = useState<RealtimeErrorCode | undefined>();
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [nextRetryAt, setNextRetryAt] = useState<number | undefined>(undefined);

  const statusRef = useRef<RealtimeStatus>('idle');
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const outputTimeRef = useRef(0);
  const reconnectAttemptsRef = useRef(0);
  const reconnectingRef = useRef(false);
  const reconnectRef = useRef<() => void>(() => {});
  const lockIdRef = useRef<string>(generateTabId());
  const lockKey = useMemo(
    () => `${REALTIME_LOCK_PREFIX}:${conversationId}`,
    [conversationId],
  );
  const wasMutedBeforeHideRef = useRef<boolean | null>(null);
  const aiTranscriptRef = useRef('');
  const userTranscriptRef = useRef('');
  const fullTranscriptRef = useRef<RealtimeTranscriptEntry[]>([]);
  const transcriptUiTimerRef = useRef<number | null>(null);
  const lastTranscriptUiUpdateRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const aiSpeakingTimerRef = useRef<number | null>(null);
  const manualResponseTimerRef = useRef<number | null>(null);
  const maxSessionTimerRef = useRef<number | null>(null);
  const visibilityTimerRef = useRef<number | null>(null);
  const connectTimeoutTimerRef = useRef<number | null>(null);
  const closingRef = useRef(false);
  const isMutedRef = useRef(false);
  const isAiSpeakingRef = useRef(false);
  const lastErrorRef = useRef<RealtimeErrorCode | undefined>(undefined);
  const voiceRef = useRef<string | undefined>(voice);
  const sessionReadyRef = useRef(false);
  const sessionTokenRef = useRef(0);
  const responseInFlightRef = useRef(false);
  const reconnectErrorRef = useRef<RealtimeErrorCode>('CONNECT_FAILED');
  const lastCommittedRef = useRef({
    user: { text: '', at: 0 },
    ai: { text: '', at: 0 },
  });
  const applyRealtimeError = useCallback(
    (error: RealtimeErrorCode | undefined) => {
      lastErrorRef.current = error;
      setLastError(error);
    },
    [],
  );

  const resetSessionState = useCallback(() => {
    setStatus('idle');
    setIsMuted(false);
    setIsAiSpeaking(false);
    setUserTranscript('');
    setAiTranscript('');
    setFullTranscript([]);
    setAudioLevel(0);
    applyRealtimeError(undefined);
    setReconnectAttempt(0);
    setNextRetryAt(undefined);
    aiTranscriptRef.current = '';
    userTranscriptRef.current = '';
    fullTranscriptRef.current = [];
    reconnectAttemptsRef.current = 0;
    reconnectingRef.current = false;
    outputTimeRef.current = 0;
    sessionReadyRef.current = false;
    responseInFlightRef.current = false;
    reconnectErrorRef.current = 'CONNECT_FAILED';
    lastCommittedRef.current = {
      user: { text: '', at: 0 },
      ai: { text: '', at: 0 },
    };
  }, [applyRealtimeError]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    sessionTokenRef.current += 1;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- must reset local session state when conversation changes
    resetSessionState();
    releaseLock(lockKey, lockIdRef.current);
  }, [conversationId, lockKey, resetSessionState]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking;
  }, [isAiSpeaking]);

  const flushTranscriptUi = useCallback(() => {
    transcriptUiTimerRef.current = null;
    lastTranscriptUiUpdateRef.current = Date.now();
    setUserTranscript(userTranscriptRef.current);
    setAiTranscript(aiTranscriptRef.current);
  }, []);

  const scheduleTranscriptUi = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastTranscriptUiUpdateRef.current;
    if (elapsed >= REALTIME_TRANSCRIPT_THROTTLE_MS) {
      flushTranscriptUi();
      return;
    }
    if (transcriptUiTimerRef.current !== null) {
      return;
    }
    transcriptUiTimerRef.current = window.setTimeout(
      flushTranscriptUi,
      REALTIME_TRANSCRIPT_THROTTLE_MS - elapsed,
    );
  }, [flushTranscriptUi]);

  const appendTranscriptEntry = useCallback(
    (entry: RealtimeTranscriptEntry) => {
      fullTranscriptRef.current = [...fullTranscriptRef.current, entry];
      setFullTranscript(fullTranscriptRef.current);
      saveQueueRef.current = saveQueueRef.current
        .then(async () => {
          await saveRealtimeTranscript({
            conversationId,
            messages: [entry],
          });
        })
        .catch(() => {
          applyRealtimeError('SAVE_FAILED');
        });
    },
    [applyRealtimeError, conversationId],
  );

  const commitTranscript = useCallback(
    (role: 'user' | 'ai', text?: string, timestamp?: string) => {
      const normalized = text?.trim();
      if (!normalized) {
        return;
      }
      const now = Date.now();
      const prev = lastCommittedRef.current[role];
      if (prev.text === normalized && now - prev.at < 3000) {
        return;
      }
      lastCommittedRef.current[role] = {
        text: normalized,
        at: now,
      };
      const entry: RealtimeTranscriptEntry = {
        role,
        text: normalized,
        timestamp: timestamp ?? new Date().toISOString(),
      };
      appendTranscriptEntry(entry);
      if (role === 'user') {
        userTranscriptRef.current = '';
        setUserTranscript('');
      } else {
        aiTranscriptRef.current = '';
        setAiTranscript('');
        // Don't clear isAiSpeaking here — let schedulePlaybackEndCheck
        // handle it when audio actually finishes playing through speakers.
      }
    },
    [appendTranscriptEntry],
  );

  const stopAudioPipeline = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (outputContextRef.current) {
      void outputContextRef.current.close();
      outputContextRef.current = null;
    }
    outputTimeRef.current = 0;
    setAudioLevel(0);
  }, []);

  const clearAiSpeakingTimer = useCallback(() => {
    if (aiSpeakingTimerRef.current !== null) {
      window.clearTimeout(aiSpeakingTimerRef.current);
      aiSpeakingTimerRef.current = null;
    }
  }, []);

  const clearManualResponseTimer = useCallback(() => {
    if (manualResponseTimerRef.current !== null) {
      window.clearTimeout(manualResponseTimerRef.current);
      manualResponseTimerRef.current = null;
    }
  }, []);

  /** Stop all scheduled AI audio immediately (used on user interruption). */
  const flushOutputAudio = useCallback(() => {
    if (outputContextRef.current) {
      void outputContextRef.current.close();
      outputContextRef.current = null;
    }
    outputTimeRef.current = 0;
    clearAiSpeakingTimer();
    clearManualResponseTimer();
    setIsAiSpeaking(false);
  }, [clearAiSpeakingTimer, clearManualResponseTimer]);

  const schedulePlaybackEndCheck = useCallback(() => {
    const checkPlaybackEnd = () => {
      const outCtx = outputContextRef.current;
      const outEnd = outputTimeRef.current;
      if (outCtx && outEnd > outCtx.currentTime + 0.2) {
        // Audio still playing — recheck after remaining duration + buffer
        const remainMs = (outEnd - outCtx.currentTime) * 1000 + 150;
        aiSpeakingTimerRef.current = window.setTimeout(
          checkPlaybackEnd,
          Math.min(remainMs, 2000),
        );
        return;
      }
      setIsAiSpeaking(false);
    };
    checkPlaybackEnd();
  }, []);

  const cleanupConnection = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    stopAudioPipeline();
    clearAiSpeakingTimer();
    clearManualResponseTimer();
    if (maxSessionTimerRef.current !== null) {
      window.clearTimeout(maxSessionTimerRef.current);
      maxSessionTimerRef.current = null;
    }
    if (connectTimeoutTimerRef.current !== null) {
      window.clearTimeout(connectTimeoutTimerRef.current);
      connectTimeoutTimerRef.current = null;
    }
    if (visibilityTimerRef.current !== null) {
      window.clearTimeout(visibilityTimerRef.current);
      visibilityTimerRef.current = null;
    }
    if (transcriptUiTimerRef.current !== null) {
      window.clearTimeout(transcriptUiTimerRef.current);
      transcriptUiTimerRef.current = null;
    }
  }, [clearAiSpeakingTimer, clearManualResponseTimer, stopAudioPipeline]);

  const disconnect = useCallback(
    (nextStatus: RealtimeStatus = 'ended') => {
      if (nextStatus !== 'reconnecting') {
        sessionTokenRef.current += 1;
      }
      closingRef.current = true;
      // Cancel any in-flight AI response before closing
      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && responseInFlightRef.current) {
        ws.send(JSON.stringify({ type: 'response.cancel' }));
      }
      cleanupConnection();
      releaseLock(lockKey, lockIdRef.current);
      setIsAiSpeaking(false);
      setUserTranscript('');
      setAiTranscript('');
      aiTranscriptRef.current = '';
      userTranscriptRef.current = '';
      setStatus(nextStatus);
      reconnectingRef.current = false;
    },
    [cleanupConnection, lockKey],
  );

  const handleRealtimeEvent = useCallback(
    (payload: Record<string, unknown>) => {
      const type = typeof payload.type === 'string' ? payload.type : '';
      if (!type) {
        return;
      }

      if (type === 'session.created' || type === 'session.updated') {
        sessionReadyRef.current = true;
        responseInFlightRef.current = false;
        applyRealtimeError(undefined);
        return;
      }

      // User started speaking — interrupt AI, cancel response, flush audio
      if (type === 'input_audio_buffer.speech_started') {
        flushOutputAudio();
        aiTranscriptRef.current = '';
        setAiTranscript('');
        const ws = socketRef.current;
        if (
          ws &&
          ws.readyState === WebSocket.OPEN &&
          (responseInFlightRef.current || isAiSpeakingRef.current)
        ) {
          ws.send(JSON.stringify({ type: 'response.cancel' }));
        }
        responseInFlightRef.current = false;
        return;
      }

      if (type === 'input_audio_buffer.speech_stopped') {
        clearManualResponseTimer();
        const expectedTranscript = aiTranscriptRef.current;
        const expectedUserDraft = userTranscriptRef.current;
        manualResponseTimerRef.current = window.setTimeout(() => {
          const ws = socketRef.current;
          const hasNoAiOutput =
            aiTranscriptRef.current === expectedTranscript && !isAiSpeakingRef.current;
          const hasStableUserDraft =
            userTranscriptRef.current === expectedUserDraft &&
            expectedUserDraft.trim().length > 0;
          if (hasStableUserDraft) {
            commitTranscript('user', expectedUserDraft);
          }
          if (!hasNoAiOutput) {
            return;
          }
          if (
            ws &&
            ws.readyState === WebSocket.OPEN &&
            sessionReadyRef.current &&
            !responseInFlightRef.current
          ) {
            responseInFlightRef.current = true;
            ws.send(
              JSON.stringify({
                type: 'response.create',
                response: { modalities: ['audio', 'text'] },
              }),
            );
          }
        }, 550);
        return;
      }

      if (
        type === 'conversation.item.created' ||
        type === 'conversation.item.updated' ||
        type === 'conversation.item.completed'
      ) {
        const role = extractItemRole(payload);
        const text = extractTranscriptText(payload);
        if (role === 'user' && text) {
          commitTranscript('user', text, extractTimestamp(payload));
        }
        if (role === 'assistant' && text) {
          aiTranscriptRef.current = text;
          scheduleTranscriptUi();
          if (type === 'conversation.item.completed') {
            commitTranscript('ai', text, extractTimestamp(payload));
          }
        }
        return;
      }

      if (type === 'server.info') {
        const maxSessionSeconds = resolveMaxSessionSeconds(payload);
        if (maxSessionSeconds) {
          if (maxSessionTimerRef.current !== null) {
            window.clearTimeout(maxSessionTimerRef.current);
          }
          maxSessionTimerRef.current = window.setTimeout(() => {
            applyRealtimeError('SESSION_EXPIRED');
            disconnect('ended');
          }, maxSessionSeconds * 1000);
        }
        return;
      }

      if (type === 'server.error') {
        const serverCode = resolveServerErrorCode(payload.code);
        const retriable = resolveRetriable(payload.retriable);
        if (serverCode) {
          applyRealtimeError(mapServerErrorToClientError(serverCode));
        } else {
          applyRealtimeError('CONNECT_FAILED');
        }
        if (retriable === false) {
          disconnect('error');
        }
        return;
      }

      if (type === 'conversation.item.input_audio_transcription.delta') {
        const delta = extractTranscriptDelta(payload);
        if (delta) {
          userTranscriptRef.current += delta;
          scheduleTranscriptUi();
        }
        return;
      }

      if (type === 'conversation.item.input_audio_transcription.completed') {
        const text = extractTranscriptText(payload);
        commitTranscript('user', text, extractTimestamp(payload));
        return;
      }

      if (type === 'response.output_item.done') {
        const role = extractItemRole(payload);
        const text = extractTranscriptText(payload);
        if (role === 'assistant' && text) {
          commitTranscript('ai', text, extractTimestamp(payload));
        }
        return;
      }

      if (
        type === 'response.created' ||
        type === 'response.in_progress' ||
        type === 'response.output_item.added'
      ) {
        responseInFlightRef.current = true;
        return;
      }

      if (
        type === 'response.audio_transcript.delta' ||
        type === 'response.output_audio_transcript.delta'
      ) {
        clearManualResponseTimer();
        const delta = extractTranscriptDelta(payload);
        if (delta) {
          aiTranscriptRef.current += delta;
          setIsAiSpeaking(true);
          scheduleTranscriptUi();
        }
        return;
      }

      if (
        type === 'response.audio_transcript.done' ||
        type === 'response.output_audio_transcript.done' ||
        type === 'response.completed'
      ) {
        clearManualResponseTimer();
        responseInFlightRef.current = false;
        const text = aiTranscriptRef.current;
        commitTranscript('ai', text, extractTimestamp(payload));
        return;
      }

      if (type === 'response.audio.delta' || type === 'response.output_audio.delta') {
        clearManualResponseTimer();
        const chunk = extractAudioDelta(payload);
        if (chunk) {
          playOutputAudio(chunk, outputContextRef, outputTimeRef);
          setIsAiSpeaking(true);
          clearAiSpeakingTimer();
          // Schedule check: when deltas stop, wait then verify playback ended
          aiSpeakingTimerRef.current = window.setTimeout(() => {
            schedulePlaybackEndCheck();
          }, REALTIME_AI_SPEAKING_TIMEOUT_MS);
        }
        return;
      }

      if (type === 'error') {
        const errorCode = extractUpstreamRealtimeErrorCode(payload);
        if (errorCode === 'response_cancel_not_active') {
          responseInFlightRef.current = false;
          return;
        }
        if (errorCode === 'conversation_already_has_active_response') {
          responseInFlightRef.current = true;
          return;
        }
        if (
          errorCode === 'session_expired' ||
          errorCode === 'invalid_session' ||
          errorCode === 'unauthorized'
        ) {
          applyRealtimeError('INVALID_REQUEST');
          disconnect('error');
        }
      }
    },
    [
      applyRealtimeError,
      clearAiSpeakingTimer,
      clearManualResponseTimer,
      commitTranscript,
      disconnect,
      flushOutputAudio,
      schedulePlaybackEndCheck,
      scheduleTranscriptUi,
    ],
  );

  const startAudioCapture = useCallback(
    async (socket: WebSocket) => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioContext = new AudioContext({
        sampleRate: REALTIME_AUDIO_SAMPLE_RATE,
      });
      audioContextRef.current = audioContext;
      await audioContext.resume();

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(
        REALTIME_AUDIO_BUFFER_SIZE,
        1,
        1,
      );
      processorRef.current = processor;

      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      // With server_vad, stream audio continuously.
      // Suppress sending while AI audio is still playing through speakers
      // to prevent echo feedback. Uses actual playback schedule, not state.
      processor.onaudioprocess = (event) => {
        if (socket.readyState !== WebSocket.OPEN) {
          return;
        }
        const outCtx = outputContextRef.current;
        const outEnd = outputTimeRef.current;
        const aiAudioPlaying = outCtx != null && outEnd > outCtx.currentTime + 0.25;
        if (isMutedRef.current || aiAudioPlaying) {
          setAudioLevel(0);
          return;
        }
        const input = event.inputBuffer.getChannelData(0);
        const rms = calculateRms(input);
        setAudioLevel(Math.min(1, Math.max(0, rms * 3.2)));

        const resampled = resampleAudio(
          input,
          audioContext.sampleRate,
          REALTIME_AUDIO_SAMPLE_RATE,
        );
        const pcm16 = floatToPcm16(resampled);
        const base64 = encodeToBase64(pcm16);
        if (!base64) {
          return;
        }
        socket.send(
          JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64,
          }),
        );
      };
    },
    [],
  );

  const sendClientEvent = useCallback((payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify(payload));
  }, []);

  const connectWithToken = useCallback(async (expectedToken: number) => {
    if (!conversationId) {
      return;
    }
    if (expectedToken !== sessionTokenRef.current) {
      return;
    }
    const currentStatus = statusRef.current;
    if (currentStatus === 'connecting' || currentStatus === 'connected') {
      return;
    }
    if (!('WebSocket' in window) || !navigator.mediaDevices?.getUserMedia) {
      applyRealtimeError('UNSUPPORTED');
      setStatus('error');
      return;
    }

    setStatus('connecting');
    applyRealtimeError(undefined);
    closingRef.current = false;

    try {
      claimLock(lockKey, lockIdRef.current);
      const accessToken = await getAccessToken();
      if (expectedToken !== sessionTokenRef.current) {
        releaseLock(lockKey, lockIdRef.current);
        return;
      }
      const wsUrl = buildRealtimeWsUrl({
        baseUrl: API_BASE_URL,
        path: REALTIME_WS_PATH,
        conversationId,
        voice: voiceRef.current,
        accessToken,
      });

      const socket = new WebSocket(wsUrl);
      if (expectedToken !== sessionTokenRef.current) {
        socket.close(1000, 'Session cancelled');
        return;
      }
      socketRef.current = socket;
      if (connectTimeoutTimerRef.current !== null) {
        window.clearTimeout(connectTimeoutTimerRef.current);
      }
      connectTimeoutTimerRef.current = window.setTimeout(() => {
        if (expectedToken !== sessionTokenRef.current) {
          return;
        }
        if (socketRef.current !== socket || socket.readyState === WebSocket.OPEN) {
          return;
        }
        reconnectErrorRef.current = 'CONNECT_FAILED';
        try {
          socket.close(1011, 'Connect timeout');
        } catch {
          // noop
        }
      }, REALTIME_CONNECT_TIMEOUT_MS);

      socket.onopen = async () => {
        if (connectTimeoutTimerRef.current !== null) {
          window.clearTimeout(connectTimeoutTimerRef.current);
          connectTimeoutTimerRef.current = null;
        }
        if (expectedToken !== sessionTokenRef.current) {
          socket.close(1000, 'Session cancelled');
          return;
        }
        try {
          await startAudioCapture(socket);
          if (expectedToken !== sessionTokenRef.current) {
            socket.close(1000, 'Session cancelled');
            return;
          }
          setIsMuted(false);
          applyRealtimeError(undefined);
          setStatus('connected');
          reconnectAttemptsRef.current = 0;
          reconnectingRef.current = false;
          setReconnectAttempt(0);
          setNextRetryAt(undefined);
        } catch (error) {
          if (expectedToken !== sessionTokenRef.current) {
            socket.close(1000, 'Session cancelled');
            return;
          }
          if (isMediaDenied(error)) {
            applyRealtimeError('MEDIA_DENIED');
          } else {
            applyRealtimeError('CONNECT_FAILED');
          }
          disconnect('error');
        }
      };

      socket.onmessage = (event) => {
        if (expectedToken !== sessionTokenRef.current) {
          return;
        }
        if (typeof event.data !== 'string') {
          return;
        }
        const payload = safeParseJson(event.data);
        if (!payload) {
          return;
        }
        handleRealtimeEvent(payload);
      };

      socket.onerror = () => {
        if (expectedToken !== sessionTokenRef.current) {
          return;
        }
        // Wait for onclose to classify and retry; avoid immediate false error toast.
      };

      socket.onclose = (event) => {
        if (expectedToken !== sessionTokenRef.current) {
          return;
        }
        if (closingRef.current) {
          closingRef.current = false;
          return;
        }
        if (event.code === 1008) {
          if (!lastErrorRef.current) {
            applyRealtimeError('PERMISSION_DENIED');
          }
          disconnect('error');
          return;
        }
        if (event.code === 1013) {
          reconnectErrorRef.current = 'RATE_LIMITED';
          if (!reconnectingRef.current) {
            reconnectRef.current();
            return;
          }
          disconnect('error');
          return;
        }
        if (event.code === 1011) {
          reconnectErrorRef.current = 'SERVICE_UNAVAILABLE';
          if (!reconnectingRef.current) {
            reconnectRef.current();
            return;
          }
        }
        if (!reconnectingRef.current) {
          reconnectErrorRef.current = 'CONNECT_FAILED';
          reconnectRef.current();
        }
      };
    } catch (error) {
      if (expectedToken !== sessionTokenRef.current) {
        return;
      }
      if (isMediaDenied(error)) {
        applyRealtimeError('MEDIA_DENIED');
      } else {
        applyRealtimeError('CONNECT_FAILED');
      }
      disconnect('error');
    }
  }, [
    applyRealtimeError,
    conversationId,
    disconnect,
    handleRealtimeEvent,
    lockKey,
    startAudioCapture,
  ]);

  const connect = useCallback(async () => {
    await connectWithToken(sessionTokenRef.current);
  }, [connectWithToken]);

  const reconnect = useCallback(async () => {
    const expectedToken = sessionTokenRef.current;
    if (reconnectingRef.current) {
      return;
    }
    if (reconnectAttemptsRef.current >= REALTIME_RECONNECT_MAX_ATTEMPTS) {
      applyRealtimeError(reconnectErrorRef.current);
      setNextRetryAt(undefined);
      disconnect('ended');
      return;
    }
    reconnectAttemptsRef.current += 1;
    setReconnectAttempt(reconnectAttemptsRef.current);
    reconnectingRef.current = true;
    disconnect('reconnecting');
    const attempt = reconnectAttemptsRef.current;
    const backoffMs = Math.min(8000, REALTIME_RECONNECT_DELAY_MS * attempt);
    setNextRetryAt(Date.now() + backoffMs);
    await delay(backoffMs);
    setNextRetryAt(undefined);
    if (expectedToken !== sessionTokenRef.current) {
      return;
    }
    await connectWithToken(expectedToken);
  }, [applyRealtimeError, connectWithToken, disconnect]);

  useEffect(() => {
    reconnectRef.current = reconnect;
  }, [reconnect]);

  const toggleMute = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) {
      return;
    }
    const track = stream.getAudioTracks()[0];
    if (!track) {
      return;
    }
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
    if (!track.enabled) {
      setAudioLevel(0);
      sendClientEvent({ type: 'input_audio_buffer.clear' });
    }
  }, [sendClientEvent]);

  useEffect(() => {
    if (voiceRef.current === voice) {
      return;
    }
    voiceRef.current = voice;
    if (statusRef.current === 'connected' && voice) {
      sendClientEvent({
        type: 'session.update',
        session: { voice },
      });
    }
  }, [sendClientEvent, voice]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        wasMutedBeforeHideRef.current = isMuted;
        if (!isMuted) {
          toggleMute();
        }
        if (visibilityTimerRef.current !== null) {
          window.clearTimeout(visibilityTimerRef.current);
        }
        visibilityTimerRef.current = window.setTimeout(() => {
          disconnect('ended');
        }, REALTIME_VISIBILITY_TIMEOUT_MS);
      } else {
        if (visibilityTimerRef.current !== null) {
          window.clearTimeout(visibilityTimerRef.current);
          visibilityTimerRef.current = null;
        }
        if (wasMutedBeforeHideRef.current === false && isMuted) {
          toggleMute();
        }
        wasMutedBeforeHideRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [disconnect, isMuted, toggleMute]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== lockKey || !event.newValue) {
        return;
      }
      const payload = safeParseJson(event.newValue);
      if (!payload || payload.id === lockIdRef.current) {
        return;
      }
      applyRealtimeError('TAKEN_OVER');
      disconnect('ended');
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [applyRealtimeError, disconnect, lockKey]);

  return {
    status,
    isMuted,
    isAiSpeaking,
    userTranscript,
    aiTranscript,
    fullTranscript,
    audioLevel,
    lastError,
    reconnectAttempt,
    reconnectMaxAttempts: REALTIME_RECONNECT_MAX_ATTEMPTS,
    nextRetryAt,
    connect,
    disconnect,
    toggleMute,
  };
}

const delay = (ms: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const buildRealtimeWsUrl = (params: {
  baseUrl: string;
  path: string;
  conversationId: string;
  voice?: string;
  accessToken?: string;
}) => {
  const base = params.baseUrl.replace(/\/$/, '');
  const httpUrl = base.startsWith('http')
    ? `${base}${params.path}`
    : `${window.location.origin}${base}${params.path}`;
  const wsUrl = httpUrl.startsWith('https://')
    ? `wss://${httpUrl.slice('https://'.length)}`
    : httpUrl.startsWith('http://')
      ? `ws://${httpUrl.slice('http://'.length)}`
      : httpUrl;
  const url = new URL(wsUrl);
  url.searchParams.set('conversationId', params.conversationId);
  if (params.voice) {
    url.searchParams.set('voice', params.voice);
  }
  if (params.accessToken) {
    url.searchParams.set('accessToken', params.accessToken);
  }
  return url.toString();
};

const safeParseJson = (value: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const extractTranscriptText = (payload: Record<string, unknown>): string | undefined => {
  const direct = payload.transcript ?? payload.text;
  if (typeof direct === 'string') {
    return direct;
  }
  const item = payload.item;
  if (item && typeof item === 'object') {
    const itemRecord = item as Record<string, unknown>;
    if (typeof itemRecord.transcript === 'string') {
      return itemRecord.transcript;
    }
    const textFromItemContent = extractTextFromContent(itemRecord.content);
    if (textFromItemContent) {
      return textFromItemContent;
    }
    const textFromItemFormatted = extractTextFromFormatted(itemRecord.formatted);
    if (textFromItemFormatted) {
      return textFromItemFormatted;
    }
  }
  const textFromPayloadContent = extractTextFromContent(payload.content);
  if (textFromPayloadContent) {
    return textFromPayloadContent;
  }
  const textFromPayloadFormatted = extractTextFromFormatted(payload.formatted);
  if (textFromPayloadFormatted) {
    return textFromPayloadFormatted;
  }
  return undefined;
};

const extractTextFromContent = (value: unknown): string | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  for (const part of value) {
    if (!part || typeof part !== 'object') {
      continue;
    }
    const record = part as Record<string, unknown>;
    const candidates = [
      record.transcript,
      record.text,
      record.output_text,
      record.audio_transcript,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
    const nested = extractTextFromFormatted(record.formatted);
    if (nested) {
      return nested;
    }
  }
  return undefined;
};

const extractTextFromFormatted = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const candidates = [
    record.transcript,
    record.text,
    record.output_text,
    record.audio_transcript,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  return undefined;
};

const extractItemRole = (
  payload: Record<string, unknown>,
): 'user' | 'assistant' | undefined => {
  const role = payload.role;
  if (role === 'ai') {
    return 'assistant';
  }
  if (role === 'user' || role === 'assistant') {
    return role;
  }
  const item = payload.item;
  if (item && typeof item === 'object') {
    const itemRole = (item as Record<string, unknown>).role;
    if (itemRole === 'ai') {
      return 'assistant';
    }
    if (itemRole === 'user' || itemRole === 'assistant') {
      return itemRole;
    }
  }
  return undefined;
};

const extractTranscriptDelta = (payload: Record<string, unknown>): string | undefined => {
  const delta = payload.delta ?? payload.text;
  return typeof delta === 'string' ? delta : undefined;
};

const extractTimestamp = (payload: Record<string, unknown>): string | undefined => {
  const raw = payload.timestamp ?? payload.created_at;
  if (typeof raw === 'string') {
    return raw;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return new Date(raw > 1e12 ? raw : raw * 1000).toISOString();
  }
  return undefined;
};

const extractAudioDelta = (payload: Record<string, unknown>): string | undefined => {
  const audio = payload.delta ?? payload.audio;
  return typeof audio === 'string' ? audio : undefined;
};

const extractUpstreamRealtimeErrorCode = (
  payload: Record<string, unknown>,
): string | undefined => {
  const error = payload.error;
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const code = (error as Record<string, unknown>).code;
  return typeof code === 'string' ? code : undefined;
};

const resolveMaxSessionSeconds = (payload: Record<string, unknown>): number | undefined => {
  const raw = payload.maxSessionSeconds ?? payload.max_session_seconds;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const resolveServerErrorCode = (raw: unknown): RealtimeServerErrorCode | undefined => {
  if (typeof raw !== 'string') {
    return undefined;
  }
  if (
    raw === 'BAD_REQUEST' ||
    raw === 'PERMISSION_DENIED' ||
    raw === 'RATE_LIMITED' ||
    raw === 'SERVICE_UNAVAILABLE' ||
    raw === 'UPSTREAM_ERROR' ||
    raw === 'INTERNAL_ERROR'
  ) {
    return raw;
  }
  return undefined;
};

const resolveRetriable = (raw: unknown): boolean | undefined => {
  return typeof raw === 'boolean' ? raw : undefined;
};

const mapServerErrorToClientError = (
  code: RealtimeServerErrorCode,
): RealtimeErrorCode => {
  if (code === 'PERMISSION_DENIED') {
    return 'PERMISSION_DENIED';
  }
  if (code === 'BAD_REQUEST') {
    return 'INVALID_REQUEST';
  }
  if (code === 'RATE_LIMITED') {
    return 'RATE_LIMITED';
  }
  if (code === 'SERVICE_UNAVAILABLE') {
    return 'SERVICE_UNAVAILABLE';
  }
  return 'CONNECT_FAILED';
};

const calculateRms = (data: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) {
    const value = data[i];
    sum += value * value;
  }
  return Math.sqrt(sum / data.length);
};

const resampleAudio = (
  input: Float32Array,
  inputRate: number,
  targetRate: number,
): Float32Array => {
  if (inputRate === targetRate) {
    return input;
  }
  const ratio = inputRate / targetRate;
  const newLength = Math.round(input.length / ratio);
  const output = new Float32Array(newLength);
  for (let i = 0; i < newLength; i += 1) {
    const index = Math.min(Math.round(i * ratio), input.length - 1);
    output[i] = input[index];
  }
  return output;
};

const floatToPcm16 = (input: Float32Array): Int16Array => {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
};

const encodeToBase64 = (pcm: Int16Array): string => {
  const buffer = new Uint8Array(pcm.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < buffer.length; i += chunkSize) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const decodeFromBase64 = (input: string): Int16Array => {
  const binary = atob(input);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    buffer[i] = binary.charCodeAt(i);
  }
  return new Int16Array(buffer.buffer);
};

const playOutputAudio = (
  base64: string,
  contextRef: MutableRefObject<AudioContext | null>,
  timeRef: MutableRefObject<number>,
) => {
  const pcm = decodeFromBase64(base64);
  const float32 = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i += 1) {
    float32[i] = pcm[i] / 32768;
  }
  if (!contextRef.current) {
    contextRef.current = new AudioContext({
      sampleRate: REALTIME_AUDIO_SAMPLE_RATE,
    });
  }
  const context = contextRef.current;
  if (context.state === 'suspended') {
    void context.resume();
  }
  const buffer = context.createBuffer(1, float32.length, REALTIME_AUDIO_SAMPLE_RATE);
  buffer.copyToChannel(float32, 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  const startAt = Math.max(context.currentTime, timeRef.current);
  source.start(startAt);
  timeRef.current = startAt + buffer.duration;
};

const isMediaDenied = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const name = (error as { name?: string }).name;
  return name === 'NotAllowedError' || name === 'PermissionDeniedError';
};

const generateTabId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.round(Math.random() * 10000)}`;
};

const claimLock = (key: string, id: string) => {
  if (typeof window === 'undefined') {
    return;
  }
  const payload = JSON.stringify({ id, ts: Date.now() });
  window.localStorage.setItem(key, payload);
};

const releaseLock = (key: string, id: string) => {
  if (typeof window === 'undefined') {
    return;
  }
  const current = window.localStorage.getItem(key);
  if (!current) {
    return;
  }
  const payload = safeParseJson(current);
  if (!payload || payload.id !== id) {
    return;
  }
  window.localStorage.removeItem(key);
};
