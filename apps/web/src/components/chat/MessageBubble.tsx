import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
  const { t } = useLocale();
  const [translationExpanded, setTranslationExpanded] = useState(false);
  const [tipsExpanded, setTipsExpanded] = useState(false);

  const translationBlock = message.translation ? (
    <div className="px-2">
      <button
        onClick={() => setTranslationExpanded(!translationExpanded)}
        className="text-xs text-label-tertiary hover:text-label-secondary flex items-center gap-1"
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
          className="text-sm text-label-secondary mt-1"
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
    message.pronunciationTip && { label: t('pronunciation'), text: message.pronunciationTip, border: 'border-l-blue-400' },
    message.rhythmTip && { label: t('rhythm'), text: message.rhythmTip, border: 'border-l-violet-400' },
    message.grammarTip && { label: t('grammar'), text: message.grammarTip, border: 'border-l-amber-400' },
  ].filter(Boolean) as { label: string; text: string; border: string }[];

  const scoreBlock =
    message.pronunciationScore !== undefined && message.audioUrl ? (
      <div className="mx-1 rounded-xl border border-separator glass-card overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => hasTips && setTipsExpanded(!tipsExpanded)}
          className={`w-full flex items-center justify-between px-3 py-2 ${hasTips ? 'cursor-pointer hover:bg-fill-secondary transition-colors' : 'cursor-default'}`}
        >
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${scoreColorClass}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
            {t('pronunciation')} {message.pronunciationScore}
          </div>
          {hasTips && (
            <span className="flex items-center gap-1 text-[11px] text-label-tertiary">
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
            className="border-t border-separator"
          >
            <div className="px-3 py-2 space-y-2">
              {tips.map((tip) => (
                <div
                  key={tip.label}
                  className={`border-l-2 ${tip.border} pl-2.5 py-0.5`}
                >
                  <span className="text-[11px] font-medium text-label-tertiary">
                    {tip.label}
                  </span>
                  <p className="text-xs text-label-secondary leading-relaxed mt-0.5">
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
      <div className="flex items-center gap-3 px-1 py-1">
        <div className="flex items-center gap-1.5">
          <span className="pulse-dot w-2 h-2 rounded-full bg-label-tertiary" />
          <span className="pulse-dot w-2 h-2 rounded-full bg-label-tertiary" />
          <span className="pulse-dot w-2 h-2 rounded-full bg-label-tertiary" />
        </div>
        <span className="text-xs text-label-tertiary">
          {t('tutorThinking')}
        </span>
      </div>
    ) : null;

  const userStatusBlock = message.statusText ? (
    <div className="px-1">
      <div className="relative overflow-hidden rounded-xl glass-status min-h-[2.35rem]">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-2/5 status-shimmer" />
        <div className="relative flex min-h-[2.25rem] items-center gap-2.5 px-3">
          <span
            className={`status-orbit ${
              message.statusTone === 'error'
                ? 'status-orbit-error'
                : message.statusTone === 'rerouting'
                    ? 'status-orbit-rerouting'
                    : ''
            }`}
          />
          <span className="text-xs text-label leading-tight">
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
          <div className="bg-primary text-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-lg">
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
        <div className="glass-card border border-separator shadow-lg px-4 py-3 rounded-2xl rounded-tl-sm">
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
