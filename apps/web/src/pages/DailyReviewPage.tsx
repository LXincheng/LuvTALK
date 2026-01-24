import { useState } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';
import { useLocale } from '../providers/LocaleContext';

interface ReviewCard {
  id: string;
  word: string;
  translation: string;
  example: string;
  exampleTranslation: string;
}

const reviewCards: ReviewCard[] = [
  {
    id: '1',
    word: '唔该',
    translation: 'Please / Thanks',
    example: '唔该帮我解释下。',
    exampleTranslation: 'Please help explain this.',
  },
  {
    id: '2',
    word: '谢谢',
    translation: 'Thank you',
    example: '谢谢你的帮助。',
    exampleTranslation: 'Thank you for your help.',
  },
  {
    id: '3',
    word: 'Hello',
    translation: '你好',
    example: 'Hello, nice to meet you.',
    exampleTranslation: '你好，很高兴认识你。',
  },
  {
    id: '4',
    word: '请问',
    translation: 'Excuse me / May I ask',
    example: '请问这个怎么说？',
    exampleTranslation: 'May I ask how to say this?',
  },
  {
    id: '5',
    word: 'Nice to meet you',
    translation: '很高兴认识你',
    example: 'Nice to meet you. I am learning Cantonese.',
    exampleTranslation: '很高兴认识你。我在学习粤语。',
  },
];

export default function DailyReviewPage() {
  const { t } = useLocale();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [needPracticeCount, setNeedPracticeCount] = useState(0);

  const currentCard = reviewCards[currentIndex];
  const isComplete = currentIndex >= reviewCards.length;

  const handleKnow = () => {
    setReviewedCount((prev) => prev + 1);
    nextCard();
  };

  const handlePractice = () => {
    setNeedPracticeCount((prev) => prev + 1);
    nextCard();
  };

  const nextCard = () => {
    setShowTranslation(false);
    if (currentIndex < reviewCards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(reviewCards.length);
    }
  };

  const restart = () => {
    setCurrentIndex(0);
    setReviewedCount(0);
    setNeedPracticeCount(0);
    setShowTranslation(false);
  };

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
      <div className="w-full max-w-lg mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {t('reviewCardLabel')} {currentIndex + 1} / {reviewCards.length}
          </span>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {reviewedCount} {t('reviewKnown')} · {needPracticeCount}{' '}
            {t('reviewPractice')}
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
          <div
            className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentIndex / reviewCards.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="glass-card rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 max-w-lg w-full min-h-[400px] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div className="text-center">
            <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mb-2">
              {t('reviewWordLabel')}
            </p>
            <h2 className="text-4xl font-semibold text-slate-900 dark:text-white mb-4">
              {currentCard.word}
            </h2>
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
                  {currentCard.translation}
                </p>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-xl p-4 border border-indigo-100 dark:border-indigo-900">
                <p className="text-sm text-indigo-600 dark:text-indigo-400 mb-2">
                  {t('reviewExample')}
                </p>
                <p className="text-slate-900 dark:text-white mb-1">
                  {currentCard.example}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                  {currentCard.exampleTranslation}
                </p>
              </div>
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
