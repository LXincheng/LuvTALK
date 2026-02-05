import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'motion/react';
import AnnotatedMessage from './AnnotatedMessage';
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

  const scoreBlock =
    message.pronunciationScore !== undefined ? (
      <div className="flex justify-end px-2">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
            message.pronunciationScore >= 80
              ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300'
              : message.pronunciationScore >= 60
                ? 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300'
                : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
          }`}
        >
          {t('pronunciation')}: {message.pronunciationScore}/100
        </div>
      </div>
    ) : null;

  const audioBlock = message.audioUrl ? (
    <div className="px-2">
      <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/50 px-3 py-2">
        <audio
          controls
          src={message.audioUrl}
          className="w-full h-10 rounded-full bg-slate-100/60 dark:bg-slate-800/60"
        />
      </div>
    </div>
  ) : null;

  const loadingBlock =
    message.type === 'ai' && message.isLoading ? (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-indigo-400/80 animate-pulse" />
          <span
            className="w-2 h-2 rounded-full bg-indigo-400/60 animate-pulse"
            style={{ animationDelay: '0.15s' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-indigo-400/40 animate-pulse"
            style={{ animationDelay: '0.3s' }}
          />
        </div>
        <span className="text-sm text-slate-500 dark:text-slate-300">
          {t('tutorThinking')}
        </span>
      </div>
    ) : null;

  if (message.type === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-md md:max-w-lg space-y-2">
          <div className="bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-lg">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          {translationBlock}
          {scoreBlock}
          {audioBlock}
          {message.statusText && (
            <div className="px-2">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {message.statusText}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-md md:max-w-lg space-y-2">
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
