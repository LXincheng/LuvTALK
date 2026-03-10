import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import AnnotatedMessage from './AnnotatedMessage';
import AudioPlayer from './AudioPlayer';
import { useLocale } from '../../providers/LocaleContext';
import type { Message, Annotation } from '../../types/chat';

interface MessageBubbleProps {
  message: Message;
  onSaveVocabulary?: (payload: Annotation) => void;
}

export default function MessageBubble({
  message,
  onSaveVocabulary,
}: MessageBubbleProps) {
  const { t, locale } = useLocale();
  const [translationExpanded, setTranslationExpanded] = useState(false);
  const [tipsExpanded, setTipsExpanded] = useState(false);
  const loadingHint = useMemo(
    () =>
      locale === 'zh'
        ? '正在组织更清晰的学习建议...'
        : 'Structuring clearer coaching guidance...',
    [locale],
  );

  const translationBlock = message.translation ? (
    <div className="px-2">
      <button
        onClick={() => setTranslationExpanded(!translationExpanded)}
        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
      >
        {t('translation')}
        {translationExpanded ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>
      {translationExpanded && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="text-sm text-slate-600 dark:text-slate-400 mt-1"
        >
          {message.translation}
        </motion.p>
      )}
    </div>
  ) : null;

  const hasTips = message.pronunciationTip || message.rhythmTip || message.grammarTip;

  const scoreColorClass =
    message.pronunciationScore !== undefined && message.pronunciationScore >= 80
      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
      : message.pronunciationScore !== undefined && message.pronunciationScore >= 60
        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
        : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300';

  const tips = [
    message.pronunciationTip && { icon: '🗣', label: t('pronunciation'), text: message.pronunciationTip, border: 'border-l-blue-400' },
    message.rhythmTip && { icon: '🎵', label: t('rhythm'), text: message.rhythmTip, border: 'border-l-purple-400' },
    message.grammarTip && { icon: '✏️', label: t('grammar'), text: message.grammarTip, border: 'border-l-amber-400' },
  ].filter(Boolean) as { icon: string; label: string; text: string; border: string }[];

  const scoreBlock =
    message.pronunciationScore !== undefined ? (
      <div className="mx-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/70 dark:bg-slate-800/50 backdrop-blur-sm overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => hasTips && setTipsExpanded(!tipsExpanded)}
          className={`w-full flex items-center justify-between px-3 py-2 ${hasTips ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors' : 'cursor-default'}`}
        >
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${scoreColorClass}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
            {t('pronunciation')} {message.pronunciationScore}
          </div>
          {hasTips && (
            <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
              {tips.length} {t('tips')}
              {tipsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </span>
          )}
        </button>
        {hasTips && tipsExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-slate-100 dark:border-slate-700/60"
          >
            <div className="px-3 py-2 space-y-2">
              {tips.map((tip) => (
                <div
                  key={tip.label}
                  className={`border-l-2 ${tip.border} pl-2.5 py-0.5`}
                >
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {tip.icon} {tip.label}
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5">
                    {tip.text}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    ) : null;

  const audioBlock = message.audioUrl ? (
    <div className="px-2">
      <AudioPlayer src={message.audioUrl} compact />
    </div>
  ) : null;

  const loadingBlock =
    message.type === 'ai' && message.isLoading ? (
      <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/55 p-3 backdrop-blur-2xl dark:border-slate-700/80 dark:bg-slate-900/45">
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-70"
          animate={{ opacity: [0.45, 0.72, 0.45] }}
          transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
          style={{
            background:
              'linear-gradient(110deg, transparent 0%, rgba(148,163,184,0.14) 48%, transparent 100%)',
          }}
        />
        <div className="relative space-y-2.5">
          <div className="flex items-center gap-3">
            <motion.div
              className="relative h-5 w-5 rounded-full border border-slate-400/60 bg-white/35 dark:border-slate-400/50 dark:bg-slate-700/30"
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
            >
              <motion.div
                className="absolute inset-[5px] rounded-full bg-slate-400/60 dark:bg-slate-300/60"
                animate={{ opacity: [0.5, 0.95, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
              />
            </motion.div>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {t('tutorThinking')}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{loadingHint}</p>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-300/45 dark:bg-slate-700/55">
            <motion.div
              className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-slate-400/70 via-slate-200/90 to-slate-400/70 dark:from-slate-400/60 dark:via-slate-200/80 dark:to-slate-400/60"
              animate={{ x: ['-30%', '210%'] }}
              transition={{ repeat: Infinity, duration: 3.1, ease: 'linear' }}
            />
          </div>
        </div>
      </div>
    ) : null;

  const userStatusBlock = message.statusText ? (
    <div className="px-1">
      <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white/70 backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-800/50 min-h-[2.25rem]">
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-70"
          animate={{ x: ['-30%', '30%'] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: 'linear' }}
          style={{
            background:
              message.statusTone === 'error'
                ? 'linear-gradient(90deg, transparent 0%, rgba(248,113,113,0.16) 50%, transparent 100%)'
                : message.statusTone === 'rerouting'
                  ? 'linear-gradient(90deg, transparent 0%, rgba(192,132,252,0.16) 50%, transparent 100%)'
                  : 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.14) 50%, transparent 100%)',
          }}
        />
        <div className="relative flex min-h-[2.25rem] items-center gap-2.5 px-3">
          {message.statusTone === 'error' ? (
            <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
          ) : message.statusTone === 'rerouting' ? (
            <Sparkles className="h-4 w-4 text-violet-500 dark:text-violet-300" />
          ) : message.statusTone === 'waiting' ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500 dark:text-indigo-300" />
          ) : message.statusTone === 'sending' ? (
            <Loader2 className="h-4 w-4 animate-spin text-sky-500 dark:text-sky-300" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
          )}
          <span className="text-xs text-slate-600 dark:text-slate-300 leading-tight">
            {message.statusText}
          </span>
        </div>
      </div>
    </div>
  ) : null;

  if (message.type === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] sm:max-w-md md:max-w-lg space-y-2">
          <div className="bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-lg">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          {translationBlock}
          {scoreBlock}
          {audioBlock}
          {userStatusBlock}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] sm:max-w-md md:max-w-lg space-y-2">
        <div className="glass-card border border-slate-200 dark:border-slate-700 shadow-lg px-4 py-3 rounded-2xl rounded-tl-sm">
          {loadingBlock ? (
            loadingBlock
          ) : (
            <AnnotatedMessage
              content={message.content}
              annotations={message.annotations}
              onSaveVocabulary={onSaveVocabulary}
            />
          )}
        </div>
        {translationBlock}
        {audioBlock}
      </div>
    </div>
  );
}
