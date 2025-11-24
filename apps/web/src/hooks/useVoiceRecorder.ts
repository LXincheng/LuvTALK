import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface VoiceMemo {
  blob: Blob;
  url: string;
  durationMs: number;
}

interface UseVoiceRecorderResult {
  isSupported: boolean;
  isRecording: boolean;
  memo?: VoiceMemo;
  error?: string;
  permissionDenied: boolean;
  start: () => Promise<boolean>;
  stop: () => void;
  reset: () => void;
}

const pickSupportedMimeType = () => {
  if (
    typeof MediaRecorder === 'undefined' ||
    typeof MediaRecorder.isTypeSupported !== 'function'
  ) {
    return undefined;
  }
  const candidates = [
    'audio/mpeg',
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
  ];
  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    } catch {
      continue;
    }
  }
  return undefined;
};

export const useVoiceRecorder = (): UseVoiceRecorderResult => {
  const [isRecording, setIsRecording] = useState(false);
  const [memo, setMemo] = useState<VoiceMemo | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderMimeTypeRef = useRef<string>('audio/webm');
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimestampRef = useRef<number>(0);
  const lastUrlRef = useRef<string | undefined>();

  const cleanupStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const resetMemo = useCallback(() => {
    if (lastUrlRef.current) {
      URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = undefined;
    }
    setMemo(undefined);
  }, []);

  useEffect(() => {
    if (memo?.url && memo.url !== lastUrlRef.current) {
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
      }
      lastUrlRef.current = memo.url;
    }
  }, [memo]);

  useEffect(() => {
    return () => {
      cleanupStream();
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = undefined;
      }
    };
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('当前设备不支持语音输入');
      setPermissionDenied(false);
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderMimeTypeRef.current = mimeType ?? 'audio/webm';
      recorderRef.current = recorder;
      chunksRef.current = [];
      startTimestampRef.current = Date.now();
      setError(undefined);
      setPermissionDenied(false);

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });
      recorder.addEventListener('stop', () => {
        cleanupStream();
        if (!chunksRef.current.length) {
          setMemo(undefined);
          return;
        }
        const blob = new Blob(chunksRef.current, {
          type: recorderMimeTypeRef.current ?? 'audio/webm',
        });
        const durationMs = Date.now() - startTimestampRef.current;
        setMemo({
          blob,
          durationMs,
          url: URL.createObjectURL(blob),
        });
        setIsRecording(false);
      });

      recorder.start();
      setIsRecording(true);
      return true;
    } catch (caught) {
      cleanupStream();
      setIsRecording(false);
      if (caught instanceof DOMException && caught.name === 'NotAllowedError') {
        setPermissionDenied(true);
      }
      setError(caught instanceof Error ? caught.message : '无法使用麦克风');
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    if (!recorderRef.current) {
      return;
    }
    if (recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    cleanupStream();
    setIsRecording(false);
    setError(undefined);
    resetMemo();
  }, [resetMemo, stop]);

  const isSupported = useMemo(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }
    return (
      typeof MediaRecorder !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function'
    );
  }, []);

  return {
    isSupported,
    isRecording,
    memo,
    error,
    permissionDenied,
    start,
    stop,
    reset,
  };
};
