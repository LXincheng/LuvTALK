export const REALTIME_SUBTITLE_LIMIT = 4;
export const REALTIME_TRANSCRIPT_THROTTLE_MS = 80;
export const REALTIME_AUDIO_FPS = 30;
export const REALTIME_AUDIO_SAMPLE_RATE = 24_000;
export const REALTIME_AUDIO_BUFFER_SIZE = 1024;
export const REALTIME_AI_SPEAKING_TIMEOUT_MS = 500;
export const REALTIME_AUDIO_PLAYBACK_SUPPRESSION_MS = 0.2;
export const REALTIME_INPUT_NOISE_GATE_RMS = 0.0025;
export const REALTIME_RECONNECT_MAX_ATTEMPTS = 4;
export const REALTIME_RECONNECT_DELAY_MS = 1800;
export const REALTIME_CONNECT_TIMEOUT_MS = 10_000;
export const REALTIME_VISIBILITY_TIMEOUT_MS = 30_000;
export const REALTIME_LOCK_PREFIX = 'luvtalk:realtime:lock';
export const REALTIME_AUDIO_ANALYSER_FFT_SIZE = 1024;
export const REALTIME_WS_PATH = '/realtime/ws';
export const REALTIME_MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};
