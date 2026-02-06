import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  compact?: boolean;
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function AudioPlayer({ src, compact }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const animFrameRef = useRef<number>(0);

  const syncProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    const dur = audio.duration;
    if (dur && Number.isFinite(dur)) {
      setProgress(audio.currentTime / dur);
    }
    if (!audio.paused) {
      animFrameRef.current = requestAnimationFrame(syncProgress);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio && Number.isFinite(audio.duration)) {
      setDuration(audio.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  };

  const handlePlay = () => {
    setIsPlaying(true);
    animFrameRef.current = requestAnimationFrame(syncProgress);
  };

  const handlePause = () => {
    setIsPlaying(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
    setCurrentTime(audio.currentTime);
  };

  const timeLabel = duration > 0
    ? `${formatTime(currentTime)} / ${formatTime(duration)}`
    : formatTime(currentTime);

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-white/5 backdrop-blur-md px-3 ${compact ? 'py-1.5' : 'py-2'}`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={handlePlay}
        onPause={handlePause}
      />
      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-indigo-500/80 dark:bg-indigo-400/80 text-white hover:bg-indigo-600/90 dark:hover:bg-indigo-500/90 transition-colors"
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3.5 h-3.5 ml-0.5" />
        )}
      </button>
      <div
        className="flex-1 h-1.5 rounded-full bg-slate-200/60 dark:bg-slate-700/60 cursor-pointer relative overflow-hidden"
        onClick={handleSeek}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-indigo-500/80 dark:bg-indigo-400/70 transition-[width] duration-75"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400 flex-shrink-0 min-w-[3.2rem] text-right">
        {timeLabel}
      </span>
    </div>
  );
}
