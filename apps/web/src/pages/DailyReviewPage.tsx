import { useEffect, useMemo, useState } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';
import { useLocale } from '../providers/LocaleContext';
import { fetchDailyReviewCached, submitReviewFeedback } from '../services/reviewService';
import { toast } from '../utils/toast';
import {
  startConversation,
  synthesizeConversationSpeech,
} from '../services/conversationService';
import AudioPlayer from '../components/chat/AudioPlayer';
import ReviewFlipCard from '../components/micro/ReviewFlipCard';
import ProgressCelebration from '../components/micro/ProgressCelebration';
import type { DailyReviewPayload, LanguageCode, ReviewCard } from '../types/api';

const getStoredTargetLanguage = (): LanguageCode => {
  if (typeof window === 'undefined') {
    return 'cantonese';
  }
  const stored = window.localStorage.getItem('targetLanguage') as
    | LanguageCode
    | null;
  if (stored === 'cantonese' || stored === 'mandarin' || stored === 'english') {
    return stored;
  }
  return 'cantonese';
};

const getCardLabel = (card: ReviewCard) =>
  card.definition ?? card.exampleTranslation ?? '';

const getCardExample = (card: ReviewCard) =>
  card.example ?? card.definition ?? '';

export default function DailyReviewPage() {
  const { t, locale } = useLocale();
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [needPracticeCount, setNeedPracticeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsConversationId, setTtsConversationId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;
    const { cached, fresh } = fetchDailyReviewCached();

    const applyPayload = (payload: DailyReviewPayload) => {
      if (!isMounted) return;
      setCards(payload.cards);
      const fallbackConversationId =
        payload.cards.find((card) => card.conversationId)?.conversationId ?? null;
      setTtsConversationId(fallbackConversationId);
    };

    if (cached) {
      applyPayload(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    fresh
      .then(applyPayload)
      .catch(() => {
        if (!isMounted) return;
        toast.error(t('reviewLoadError'), { id: 'review' });
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [t]);

  const currentCard = cards[currentIndex];
  const isComplete = currentIndex >= cards.length;
  const progressValue = useMemo(() => {
    if (cards.length === 0) {
      return 0;
    }
    return Math.min(100, (currentIndex / cards.length) * 100);
  }, [cards.length, currentIndex]);

  const resetAudio = () => {
    setAudioUrl(null);
    setIsSpeaking(false);
  };

  const nextCard = () => {
    resetAudio();
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(cards.length);
    }
  };

  const sendFeedback = async (action: 'known' | 'practice') => {
    if (!currentCard) {
      return;
    }
    try {
      await submitReviewFeedback({
        cardId: currentCard.id,
        action,
        sourceType: currentCard.sourceType,
        conversationId: currentCard.conversationId ?? ttsConversationId ?? undefined,
      });
    } catch {
      toast.error(t('reviewFeedbackError'), { id: 'review' });
    }
  };

  const handleKnow = async () => {
    setReviewedCount((prev) => prev + 1);
    await sendFeedback('known');
    nextCard();
  };

  const handlePractice = async () => {
    setNeedPracticeCount((prev) => prev + 1);
    await sendFeedback('practice');
    nextCard();
  };

  const restart = () => {
    setCurrentIndex(0);
    setReviewedCount(0);
    setNeedPracticeCount(0);
    resetAudio();
  };

  const ensureTtsConversationId = async () => {
    if (ttsConversationId) {
      return ttsConversationId;
    }
    try {
      const session = await startConversation({
        targetLanguage: getStoredTargetLanguage(),
        nativeLanguage: locale === 'zh' ? 'mandarin' : 'english',
      });
      setTtsConversationId(session.id);
      return session.id;
    } catch {
      return null;
    }
  };

  const handleSpeak = async () => {
    if (!currentCard || isSpeaking) {
      return;
    }
    setIsSpeaking(true);
    const conversationId =
      currentCard.conversationId ?? (await ensureTtsConversationId());
    if (!conversationId) {
      setIsSpeaking(false);
      toast.warning(t('reviewTtsUnavailable'), { id: 'tts' });
      return;
    }
    try {
      const payload = await synthesizeConversationSpeech(
        conversationId,
        currentCard.term,
      );
      setAudioUrl(payload.audioUrl);
    } catch {
      toast.error(t('reviewTtsError'), { id: 'tts' });
    } finally {
      setIsSpeaking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4 bg-surface">
        <div className="w-full max-w-lg space-y-6 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-4 bg-fill rounded w-24" />
            <div className="h-4 bg-fill rounded w-32" />
          </div>
          <div className="w-full bg-fill rounded-full h-2" />
          <div className="glass-card rounded-2xl p-8 min-h-[420px] flex flex-col items-center justify-center space-y-6">
            <div className="h-4 bg-fill rounded w-20" />
            <div className="h-10 bg-fill rounded w-48" />
            <div className="h-8 bg-fill rounded-xl w-28" />
            <div className="h-4 bg-fill rounded w-24" />
          </div>
        </div>
      </div>
    );
  }

  if (!isLoading && cards.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-4 bg-surface">
        <div className="glass-card rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <h2 className="text-xl font-semibold text-label">
            {t('reviewEmptyTitle')}
          </h2>
          <p className="text-label-secondary">
            {t('reviewEmptyHint')}
          </p>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="h-full flex items-center justify-center px-4 bg-surface">
        <div className="relative glass-card rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-6">
          <ProgressCelebration trigger={isComplete} />
          <div className="w-20 h-20 bg-[var(--color-primary-soft)] rounded-full flex items-center justify-center mx-auto">
            <Check className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-label mb-2">
              {t('reviewCompleteTitle')}
            </h2>
            <p className="text-label-secondary">
              {t('reviewCompleteSubtitle')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="bg-success/10 rounded-xl p-4 border border-success/20">
              <p className="text-3xl font-bold text-success">
                {reviewedCount}
              </p>
              <p className="text-sm text-success mt-1">
                {t('reviewKnown')}
              </p>
            </div>
            <div className="bg-warning/10 rounded-xl p-4 border border-warning/20">
              <p className="text-3xl font-bold text-warning">
                {needPracticeCount}
              </p>
              <p className="text-sm text-warning mt-1">
                {t('reviewPractice')}
              </p>
            </div>
          </div>
          <button
            onClick={restart}
            className="w-full glass-button text-white px-6 py-3 rounded-xl font-medium transition-all hover:opacity-90 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            {t('reviewAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-4 bg-surface">
      <div className="w-full max-w-lg mb-6 space-y-3">
        {errorMessage && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-label-secondary">
            {t('reviewCardLabel')} {currentIndex + 1} / {cards.length}
          </span>
          <span className="text-sm text-label-secondary">
            {reviewedCount} {t('reviewKnown')} · {needPracticeCount}{' '}
            {t('reviewPractice')}
          </span>
        </div>
        <div className="w-full bg-fill rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressValue}%` }}
          />
        </div>
      </div>

      <div className="glass-card rounded-2xl shadow-xl p-6 sm:p-8 max-w-lg w-full min-h-[420px] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <ReviewFlipCard
            term={currentCard.term}
            translation={getCardLabel(currentCard)}
            example={getCardExample(currentCard)}
            onSpeak={handleSpeak}
            speakLabel={isSpeaking ? t('reviewLoading') : t('reviewSpeak')}
            flipHint={t('reviewFlipHint')}
          />
          {audioUrl && (
            <div className="max-w-xs mx-auto w-full">
              <AudioPlayer src={audioUrl} compact autoPlay />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            onClick={handlePractice}
            className="flex items-center justify-center gap-2 rounded-xl border border-separator bg-surface-elevated px-6 py-3 font-medium text-label-secondary shadow-sm transition hover:bg-[var(--color-primary-soft)]/45"
          >
            <X className="w-5 h-5" />
            {t('reviewNeedPractice')}
          </button>
          <button
            onClick={handleKnow}
            className="flex items-center justify-center gap-2 px-6 py-3 glass-button text-white rounded-xl font-medium transition-all hover:opacity-90"
          >
            <Check className="w-5 h-5" />
            {t('reviewKnowThis')}
          </button>
        </div>
      </div>
    </div>
  );
}
