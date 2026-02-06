import { useEffect, useMemo, useState } from 'react';
import { Check, X, RotateCcw, Volume2 } from 'lucide-react';
import { useLocale } from '../providers/LocaleContext';
import { fetchDailyReview, submitReviewFeedback } from '../services/reviewService';
import {
  startConversation,
  synthesizeConversationSpeech,
} from '../services/conversationService';
import AudioPlayer from '../components/chat/AudioPlayer';
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
  const [showTranslation, setShowTranslation] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [needPracticeCount, setNeedPracticeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsConversationId, setTtsConversationId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);
    fetchDailyReview()
      .then((payload: DailyReviewPayload) => {
        if (!isMounted) {
          return;
        }
        setCards(payload.cards);
        const fallbackConversationId =
          payload.cards.find((card) => card.conversationId)?.conversationId ??
          null;
        setTtsConversationId(fallbackConversationId);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setErrorMessage(t('reviewLoadError'));
      })
      .finally(() => {
        if (!isMounted) {
          return;
        }
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
    setShowTranslation(false);
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
      setErrorMessage(t('reviewFeedbackError'));
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
    setShowTranslation(false);
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
    setErrorMessage(null);
    const conversationId =
      currentCard.conversationId ?? (await ensureTtsConversationId());
    if (!conversationId) {
      setIsSpeaking(false);
      setErrorMessage(t('reviewTtsUnavailable'));
      return;
    }
    try {
      const payload = await synthesizeConversationSpeech(
        conversationId,
        currentCard.term,
      );
      setAudioUrl(payload.audioUrl);
      const audio = new Audio(payload.audioUrl);
      await audio.play();
    } catch {
      setErrorMessage(t('reviewTtsError'));
    } finally {
      setIsSpeaking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center px-4 bg-slate-50 dark:bg-slate-950">
        <div className="glass-card rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-8 max-w-md w-full text-center text-slate-600 dark:text-slate-400">
          {t('reviewLoading')}
        </div>
      </div>
    );
  }

  if (!isLoading && cards.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-4 bg-slate-50 dark:bg-slate-950">
        <div className="glass-card rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-8 max-w-md w-full text-center space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('reviewEmptyTitle')}
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            {t('reviewEmptyHint')}
          </p>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="h-full flex items-center justify-center px-4 bg-slate-50 dark:bg-slate-950">
        <div className="glass-card rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-8 max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-950 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
              {t('reviewCompleteTitle')}
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              {t('reviewCompleteSubtitle')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-4 border border-green-100 dark:border-green-900">
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {reviewedCount}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {t('reviewKnown')}
              </p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-xl p-4 border border-yellow-100 dark:border-yellow-900">
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                {needPracticeCount}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
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
    <div className="h-full flex flex-col items-center justify-center px-4 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-lg mb-6 space-y-3">
        {errorMessage && (
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {errorMessage}
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {t('reviewCardLabel')} {currentIndex + 1} / {cards.length}
          </span>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {reviewedCount} {t('reviewKnown')} · {needPracticeCount}{' '}
            {t('reviewPractice')}
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
          <div
            className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressValue}%` }}
          />
        </div>
      </div>

      <div className="glass-card rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 max-w-lg w-full min-h-[420px] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div className="text-center space-y-3">
            <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
              {t('reviewWordLabel')}
            </p>
            <h2 className="text-4xl font-semibold text-slate-900 dark:text-white">
              {currentCard.term}
            </h2>
            <button
              onClick={handleSpeak}
              disabled={isSpeaking}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
            >
              <Volume2 className="w-4 h-4" />
              {t('reviewSpeak')}
            </button>
          </div>

          <button
            onClick={() => setShowTranslation(!showTranslation)}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium underline"
          >
            {showTranslation ? t('reviewHide') : t('reviewShow')}
          </button>

          {showTranslation && (
            <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  {t('reviewTranslation')}
                </p>
                <p className="text-lg text-slate-900 dark:text-white">
                  {getCardLabel(currentCard)}
                </p>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-xl p-4 border border-indigo-100 dark:border-indigo-900">
                <p className="text-sm text-indigo-600 dark:text-indigo-400 mb-2">
                  {t('reviewExample')}
                </p>
                <p className="text-slate-900 dark:text-white mb-1">
                  {getCardExample(currentCard)}
                </p>
                {currentCard.exampleTranslation && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                    {currentCard.exampleTranslation}
                  </p>
                )}
              </div>
              {audioUrl && (
                <AudioPlayer src={audioUrl} />
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            onClick={handlePractice}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors"
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
