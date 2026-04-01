import { Star, Trash2, Copy, Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { fetchFavoritesCached, removeFavorite } from '../services/favoritesService';
import type { FavoriteItem, FavoriteType } from '../types/api';
import { useLocale } from '../providers/LocaleContext';
import { toast } from '../utils/toast';

export default function FavoritesPage() {
  const { t, locale } = useLocale();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'all' | FavoriteType>(
    'all',
  );
  const [isLoading, setIsLoading] = useState(true);

  const copyLabel = t('favoritesCopy');
  const removeLabel = t('favoritesRemove');
  const addedLabel = t('favoritesAdded');

  const favoriteTypeLabels: Record<FavoriteType, string> = useMemo(
    () => ({
      phrase: t('favoriteTypePhrase'),
      cultural: t('favoriteTypeCultural'),
      vocabulary: t('favoriteTypeVocabulary'),
      scenario: t('favoriteTypeScenario'),
    }),
    [t],
  );

  useEffect(() => {
    let isMounted = true;
    const { cached, fresh } = fetchFavoritesCached();

    if (cached) {
      void Promise.resolve().then(() => {
        if (!isMounted) return;
        setFavorites(cached);
        setIsLoading(false);
      });
    }

    fresh
      .then((items) => {
        if (!isMounted) return;
        setFavorites(items);
      })
      .catch(() => {
        if (!isMounted) return;
        toast.error(t('favoritesLoadError'), { id: 'favorites' });
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [t]);

  const categories = useMemo(() => {
    const types = Array.from(new Set(favorites.map((item) => item.type)));
    return [
      { id: 'all' as const, label: t('categoryAll') },
      ...types.map((type) => ({
        id: type,
        label: favoriteTypeLabels[type],
      })),
    ];
  }, [favoriteTypeLabels, favorites, t]);

  const filteredFavorites =
    selectedCategory === 'all'
      ? favorites
      : favorites.filter((favorite) => favorite.type === selectedCategory);

  const handleDelete = async (id: string) => {
    try {
      await removeFavorite(id);
      setFavorites((prev) => prev.filter((favorite) => favorite.id !== id));
    } catch {
      toast.error(t('favoritesDeleteError'), { id: 'favorites' });
    }
  };

  const handleCopy = (phrase: string, id: string) => {
    if (!navigator.clipboard) {
      toast.warning(t('favoritesClipboardUnsupported'), { id: 'clipboard' });
      return;
    }
    navigator.clipboard.writeText(phrase).catch(() => {
      toast.error(t('favoritesCopyError'), { id: 'clipboard' });
      return;
    });
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="page-shell h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 py-5 md:py-6">
        <div className="page-panel mb-5 rounded-[30px] px-5 py-5">
          <h1 className="text-3xl font-semibold text-label mb-2 tracking-[-0.05em]">
            {t('favoritesTitle')}
          </h1>
          <p className="text-label-secondary">
            {t('favoritesSubtitle')}
          </p>
        </div>

        <div className="mb-5 overflow-x-auto pb-1">
          <div className="page-panel inline-flex min-w-full gap-1 rounded-[20px] p-1.5 sm:min-w-0">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`min-w-[88px] rounded-[16px] px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === category.id
                  ? 'bg-primary text-white'
                  : 'text-label-secondary hover:bg-fill-secondary dark:text-slate-200'
              }`}
            >
              {category.label}
            </button>
          ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="page-panel rounded-[24px] p-4">
                <div className="h-5 bg-fill rounded w-20 mb-3" />
                <div className="h-5 bg-fill rounded w-3/4 mb-2" />
                <div className="h-4 bg-fill rounded w-full mb-4" />
                <div className="h-3 bg-fill rounded w-24 mt-3 pt-3" />
              </div>
            ))}
          </div>
        ) : filteredFavorites.length === 0 ? (
          <div className="page-panel rounded-[30px] py-16 text-center">
            <div className="w-16 h-16 bg-fill rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 text-label-tertiary" />
            </div>
            <p className="text-label-secondary">
              {t('favoritesEmptyTitle')}
            </p>
            <p className="text-sm text-label-tertiary mt-1">
              {t('favoritesEmptyHint')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {filteredFavorites.map((favorite, index) => (
                <motion.div
                  key={favorite.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, delay: index * 0.02 }}
                >
                  <FavoriteCard
                    favorite={favorite}
                    categoryLabel={favoriteTypeLabels[favorite.type] ?? favorite.type}
                    onDelete={handleDelete}
                    onCopy={handleCopy}
                    isCopied={copiedId === favorite.id}
                    copyLabel={copyLabel}
                    removeLabel={removeLabel}
                    addedLabel={addedLabel}
                    createdAtLabel={new Date(favorite.createdAt).toLocaleDateString(
                      locale === 'zh' ? 'zh-CN' : 'en-US',
                      { month: 'short', day: 'numeric' },
                    )}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

interface FavoriteCardProps {
  favorite: FavoriteItem;
  categoryLabel: string;
  onDelete: (id: string) => void;
  onCopy: (phrase: string, id: string) => void;
  isCopied: boolean;
  copyLabel: string;
  removeLabel: string;
  addedLabel: string;
  createdAtLabel: string;
}

function FavoriteCard({
  favorite,
  categoryLabel,
  onDelete,
  onCopy,
  isCopied,
  copyLabel,
  removeLabel,
  addedLabel,
  createdAtLabel,
}: FavoriteCardProps) {
  return (
    <div className="page-panel group rounded-[26px] p-4 transition-all duration-300 hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-3">
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-xs font-medium text-primary">
          <Star className="w-3 h-3 fill-[var(--color-primary)]" />
          {categoryLabel}
        </span>
        <div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button
            onClick={() => onCopy(favorite.content, favorite.id)}
            className="rounded-xl p-2 transition-colors hover:bg-fill-secondary"
            title={copyLabel}
          >
            {isCopied ? (
              <Check className="w-4 h-4 text-success" />
            ) : (
              <Copy className="w-4 h-4 text-label-tertiary" />
            )}
          </button>
          <button
            onClick={() => onDelete(favorite.id)}
            className="rounded-xl p-2 hover:bg-destructive/10 transition-colors"
            title={removeLabel}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-lg font-medium tracking-[-0.03em] text-label">
          {favorite.title}
        </p>
        <p className="text-sm leading-6 text-label-secondary">
          {favorite.content}
        </p>
      </div>

      <div className="mt-4 border-t border-separator pt-3">
        <p className="text-xs text-label-tertiary">
          {addedLabel} {createdAtLabel}
        </p>
      </div>
    </div>
  );
}
