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

type ReviewViewState = 'loading' | 'ready' | 'complete' | 'empty' | 'error';

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
  const [totalCount, setTotalCount] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [needPracticeCount, setNeedPracticeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);
  const [ttsConversationId, setTtsConversationId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;
    const { cached, fresh } = fetchDailyReviewCached();

    const applyPayload = (payload: DailyReviewPayload) => {
      if (!isMounted) return;
      setCards(payload.cards);
      setTotalCount(payload.cards.length);
      setReviewedCount(0);
      setNeedPracticeCount(0);
      setErrorMessage(null);
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
        setErrorMessage(t('reviewLoadError'));
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

  const currentCard = cards[0];
  const completedCount = reviewedCount + needPracticeCount;
  const viewState: ReviewViewState = isLoading
    ? 'loading'
    : errorMessage && totalCount === 0
      ? 'error'
      : cards.length > 0
        ? 'ready'
        : totalCount > 0
          ? 'complete'
          : 'empty';
  const progressValue = useMemo(() => {
    if (totalCount === 0) {
      return 0;
    }
    return Math.min(100, (completedCount / totalCount) * 100);
  }, [completedCount, totalCount]);

  const resetAudio = () => {
    setAudioUrl(null);
    setIsSpeaking(false);
  };

  const consumeCurrentCard = () => {
    resetAudio();
    setCards((prev) => prev.slice(1));
  };

  const submitFeedbackInBackground = async (
    card: ReviewCard,
    action: 'known' | 'practice',
  ) => {
    setPendingFeedbackCount((prev) => prev + 1);
    try {
      await submitReviewFeedback({
        cardId: card.id,
        action,
        sourceType: card.sourceType,
        conversationId: card.conversationId ?? ttsConversationId ?? undefined,
      });
    } catch {
      setCards((prev) => [card, ...prev]);
      if (action === 'known') {
        setReviewedCount((prev) => Math.max(0, prev - 1));
      } else {
        setNeedPracticeCount((prev) => Math.max(0, prev - 1));
      }
      toast.error(t('reviewFeedbackError'), { id: 'review' });
    } finally {
      setPendingFeedbackCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleFeedback = (action: 'known' | 'practice') => {
    if (!currentCard) {
      return false;
    }
    const card = currentCard;
    if (action === 'known') {
      setReviewedCount((prev) => prev + 1);
    } else {
      setNeedPracticeCount((prev) => prev + 1);
    }
    consumeCurrentCard();
    void submitFeedbackInBackground(card, action);
    return true;
  };

  const handleKnow = () => {
    if (!currentCard) {
      return;
    }
    handleFeedback('known');
  };

  const handlePractice = () => {
    if (!currentCard) {
      return;
    }
    handleFeedback('practice');
  };

  const restart = () => {
    setReviewedCount(0);
    setNeedPracticeCount(0);
    resetAudio();
    setIsLoading(true);
    const { cached, fresh } = fetchDailyReviewCached();
    if (cached) {
      setCards(cached.cards);
      setTotalCount(cached.cards.length);
      setIsLoading(false);
    }
    void fresh
      .then((payload) => {
        setCards(payload.cards);
        setTotalCount(payload.cards.length);
      })
      .catch(() => {
        setErrorMessage(t('reviewLoadError'));
        toast.error(t('reviewLoadError'), { id: 'review' });
      })
      .finally(() => {
        setIsLoading(false);
      });
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

  if (viewState === 'loading') {
    return (
      <div className="h-full flex items-center justify-center px-4 bg-surface">
        <div className="review-status-panel review-status-panel--loading w-full max-w-md text-center">
          <div className="review-status-dot" aria-hidden="true" />
          <div className="mt-8 space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-label-tertiary">
              {locale === 'zh' ? '今日复习' : 'Today'}
            </p>
            <h2 className="text-[1.55rem] font-semibold tracking-[-0.045em] text-label">
              {t('reviewLoading')}
            </h2>
            <p className="text-sm text-label-secondary">
              {locale === 'zh' ? '正在整理你的卡片。' : 'Preparing your cards.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'error') {
    return (
      <div className="h-full flex items-center justify-center px-4 bg-surface">
        <div className="review-status-panel w-full max-w-md text-center">
          <div className="review-status-badge review-status-badge--error">!</div>
          <div className="mt-7 space-y-3">
            <h2 className="text-[1.55rem] font-semibold tracking-[-0.045em] text-label">
              {locale === 'zh' ? '暂时无法加载' : 'Review unavailable'}
            </h2>
            <p className="mx-auto max-w-xs text-sm text-label-secondary">
              {locale === 'zh' ? '稍后再试一次。' : 'Please retry in a moment.'}
            </p>
          </div>
          <button
            onClick={restart}
            className="mt-7 inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-[0_12px_28px_rgba(37,99,235,0.18)] transition hover:opacity-90"
          >
            {t('reviewAgain')}
          </button>
        </div>
      </div>
    );
  }

  if (viewState === 'empty') {
    return (
      <div className="h-full flex items-center justify-center px-4 bg-surface">
        <div className="review-status-panel w-full max-w-md text-center">
          <div className="review-status-badge">✓</div>
          <div className="mt-7 space-y-3">
            <h2 className="text-[1.55rem] font-semibold tracking-[-0.045em] text-label">
              {t('reviewEmptyTitle')}
            </h2>
            <p className="mx-auto max-w-xs text-sm text-label-secondary">
              {t('reviewEmptyHint')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'complete') {
    return (
      <div className="h-full flex items-center justify-center px-4 bg-surface">
        <div className="review-status-panel review-status-panel--complete relative w-full max-w-md text-center">
          <ProgressCelebration trigger={viewState === 'complete'} />
          <div className="review-status-badge review-status-badge--complete review-complete-ring">
            <Check className="w-10 h-10 text-primary" />
          </div>
          <div className="mt-7">
            <h2 className="text-[1.7rem] font-semibold tracking-[-0.05em] text-label">
              {t('reviewCompleteTitle')}
            </h2>
            <p className="mt-2 text-sm text-label-secondary">
              {t('reviewCompleteSubtitle')}
            </p>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3">
            <div className="rounded-[22px] bg-[var(--surface-panel-soft)] px-4 py-4">
              <p className="text-3xl font-semibold tracking-[-0.04em] text-label">
                {reviewedCount}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-label-tertiary">
                {t('reviewKnown')}
              </p>
            </div>
            <div className="rounded-[22px] bg-[var(--surface-panel-soft)] px-4 py-4">
              <p className="text-3xl font-semibold tracking-[-0.04em] text-label">
                {needPracticeCount}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-label-tertiary">
                {t('reviewPractice')}
              </p>
            </div>
          </div>
          <button
            onClick={restart}
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-medium text-white shadow-[0_12px_28px_rgba(37,99,235,0.18)] transition hover:opacity-90"
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
            {t('reviewCardLabel')} {Math.min(completedCount + 1, totalCount)} / {totalCount}
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

      <div className="glass-card rounded-[28px] shadow-xl p-6 sm:p-8 max-w-lg w-full min-h-[420px] flex flex-col">
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
            disabled={!currentCard}
            className="flex items-center justify-center gap-2 rounded-xl border border-separator bg-surface-elevated px-6 py-3 font-medium text-label-secondary shadow-sm transition hover:bg-[var(--color-primary-soft)]/45"
          >
            <X className="w-5 h-5" />
            {t('reviewNeedPractice')}
          </button>
          <button
            onClick={handleKnow}
            disabled={!currentCard}
            className="flex items-center justify-center gap-2 px-6 py-3 glass-button text-white rounded-xl font-medium transition-all hover:opacity-90"
          >
            <Check className="w-5 h-5" />
            {t('reviewKnowThis')}
          </button>
        </div>
        {pendingFeedbackCount > 0 ? (
          <p className="mt-3 text-center text-xs text-label-tertiary">
            {t('reviewProgressSaved')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
