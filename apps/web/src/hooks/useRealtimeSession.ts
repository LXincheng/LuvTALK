import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  REALTIME_AI_SPEAKING_TIMEOUT_MS,
  REALTIME_AUDIO_BUFFER_SIZE,
  REALTIME_AUDIO_SAMPLE_RATE,
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
import type { RealtimeErrorCode, RealtimeTranscriptEntry } from '../types/realtime';

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
  const maxSessionTimerRef = useRef<number | null>(null);
  const visibilityTimerRef = useRef<number | null>(null);
  const closingRef = useRef(false);
  const isMutedRef = useRef(false);
  const isAiSpeakingRef = useRef(false);
  const voiceRef = useRef<string | undefined>(voice);
  const sessionReadyRef = useRef(false);

  const resetSessionState = useCallback(() => {
    setStatus('idle');
    setIsMuted(false);
    setIsAiSpeaking(false);
    setUserTranscript('');
    setAiTranscript('');
    setFullTranscript([]);
    setAudioLevel(0);
    setLastError(undefined);
    aiTranscriptRef.current = '';
    userTranscriptRef.current = '';
    fullTranscriptRef.current = [];
    reconnectAttemptsRef.current = 0;
    reconnectingRef.current = false;
    outputTimeRef.current = 0;
    sessionReadyRef.current = false;
  }, []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
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
          setLastError('SAVE_FAILED');
        });
    },
    [conversationId],
  );

  const commitTranscript = useCallback(
    (role: 'user' | 'ai', text?: string, timestamp?: string) => {
      const normalized = text?.trim();
      if (!normalized) {
        return;
      }
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

  /** Stop all scheduled AI audio immediately (used on user interruption). */
  const flushOutputAudio = useCallback(() => {
    if (outputContextRef.current) {
      void outputContextRef.current.close();
      outputContextRef.current = null;
    }
    outputTimeRef.current = 0;
    clearAiSpeakingTimer();
    setIsAiSpeaking(false);
  }, [clearAiSpeakingTimer]);

  const schedulePlaybackEndCheck = useCallback(() => {
    const outCtx = outputContextRef.current;
    const outEnd = outputTimeRef.current;
    if (outCtx && outEnd > outCtx.currentTime + 0.2) {
      // Audio still playing — recheck after remaining duration + buffer
      const remainMs = (outEnd - outCtx.currentTime) * 1000 + 150;
      aiSpeakingTimerRef.current = window.setTimeout(() => {
        schedulePlaybackEndCheck();
      }, Math.min(remainMs, 2000));
      return;
    }
    setIsAiSpeaking(false);
  }, []);

  const cleanupConnection = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    stopAudioPipeline();
    clearAiSpeakingTimer();
    if (maxSessionTimerRef.current !== null) {
      window.clearTimeout(maxSessionTimerRef.current);
      maxSessionTimerRef.current = null;
    }
    if (visibilityTimerRef.current !== null) {
      window.clearTimeout(visibilityTimerRef.current);
      visibilityTimerRef.current = null;
    }
    if (transcriptUiTimerRef.current !== null) {
      window.clearTimeout(transcriptUiTimerRef.current);
      transcriptUiTimerRef.current = null;
    }
  }, [clearAiSpeakingTimer, stopAudioPipeline]);

  const disconnect = useCallback(
    (nextStatus: RealtimeStatus = 'ended') => {
      closingRef.current = true;
      // Cancel any in-flight AI response before closing
      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
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
        setLastError(undefined);
        return;
      }

      // User started speaking — interrupt AI, cancel response, flush audio
      if (type === 'input_audio_buffer.speech_started') {
        flushOutputAudio();
        aiTranscriptRef.current = '';
        setAiTranscript('');
        const ws = socketRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'response.cancel' }));
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
            setLastError('SESSION_EXPIRED');
            disconnect('ended');
          }, maxSessionSeconds * 1000);
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

      if (
        type === 'response.audio_transcript.delta' ||
        type === 'response.output_audio_transcript.delta'
      ) {
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
        const text = aiTranscriptRef.current;
        commitTranscript('ai', text, extractTimestamp(payload));
        return;
      }

      if (type === 'response.audio.delta' || type === 'response.output_audio.delta') {
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
        setLastError('CONNECT_FAILED');
      }
    },
    [clearAiSpeakingTimer, commitTranscript, disconnect, flushOutputAudio, schedulePlaybackEndCheck, scheduleTranscriptUi],
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

  const connect = useCallback(async () => {
    if (!conversationId) {
      return;
    }
    const currentStatus = statusRef.current;
    if (currentStatus === 'connecting' || currentStatus === 'connected') {
      return;
    }
    if (!('WebSocket' in window) || !navigator.mediaDevices?.getUserMedia) {
      setLastError('UNSUPPORTED');
      setStatus('error');
      return;
    }

    setStatus('connecting');
    setLastError(undefined);
    closingRef.current = false;

    try {
      claimLock(lockKey, lockIdRef.current);
      const accessToken = await getAccessToken();
      const wsUrl = buildRealtimeWsUrl({
        baseUrl: API_BASE_URL,
        path: REALTIME_WS_PATH,
        conversationId,
        voice: voiceRef.current,
        accessToken,
      });

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = async () => {
        try {
          await startAudioCapture(socket);
          setIsMuted(false);
          setLastError(undefined);
          setStatus('connected');
          reconnectAttemptsRef.current = 0;
          reconnectingRef.current = false;
        } catch (error) {
          if (isMediaDenied(error)) {
            setLastError('MEDIA_DENIED');
          } else {
            setLastError('CONNECT_FAILED');
          }
          disconnect('error');
        }
      };

      socket.onmessage = (event) => {
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
        setLastError('CONNECT_FAILED');
      };

      socket.onclose = (event) => {
        if (closingRef.current) {
          closingRef.current = false;
          return;
        }
        if (event.code === 1008) {
          setLastError('PERMISSION_DENIED');
          disconnect('error');
          return;
        }
        if (event.code === 1011 || event.code === 1013) {
          setLastError('CONNECT_FAILED');
          disconnect('error');
          return;
        }
        if (!reconnectingRef.current) {
          reconnectRef.current();
        }
      };
    } catch (error) {
      if (isMediaDenied(error)) {
        setLastError('MEDIA_DENIED');
      } else {
        setLastError('CONNECT_FAILED');
      }
      disconnect('error');
    }
  }, [
    conversationId,
    disconnect,
    handleRealtimeEvent,
    lockKey,
    startAudioCapture,
  ]);

  const reconnect = useCallback(async () => {
    if (reconnectingRef.current) {
      return;
    }
    if (reconnectAttemptsRef.current >= REALTIME_RECONNECT_MAX_ATTEMPTS) {
      setLastError('CONNECT_FAILED');
      disconnect('ended');
      return;
    }
    reconnectAttemptsRef.current += 1;
    reconnectingRef.current = true;
    disconnect('reconnecting');
    await delay(REALTIME_RECONNECT_DELAY_MS);
    await connect();
  }, [connect, disconnect]);

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
      setLastError('TAKEN_OVER');
      disconnect('ended');
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [disconnect, lockKey]);

  return {
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
    const content = (item as Record<string, unknown>).content;
    if (Array.isArray(content) && content.length > 0) {
      const first = content[0];
      if (first && typeof first === 'object') {
        const transcript = (first as Record<string, unknown>).transcript;
        if (typeof transcript === 'string') {
          return transcript;
        }
      }
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
