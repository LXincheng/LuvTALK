export const AUDIO_UPLOAD_ACCEPT =
  'audio/mp4,audio/m4a,audio/mpeg,audio/webm,audio/wav,audio/ogg,video/webm,video/mp4,.m4a,.mp3,.webm,.wav,.ogg,.mp4';

export const IMAGE_UPLOAD_ACCEPT =
  'image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif';

export const MAX_IMAGE_UPLOAD_BYTES = 6 * 1024 * 1024;

const RECORDING_MIME_CANDIDATES = [
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
] as const;

export const isVoiceRecordingSupported = (): boolean =>
  typeof window !== 'undefined' &&
  typeof MediaRecorder !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia);

export const getPreferredRecordingMime = (): string | undefined => {
  if (typeof MediaRecorder === 'undefined') {
    return undefined;
  }
  return RECORDING_MIME_CANDIDATES.find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
};

export const formatUploadLimit = (bytes: number): string =>
  `${Math.round(bytes / (1024 * 1024))}MB`;
