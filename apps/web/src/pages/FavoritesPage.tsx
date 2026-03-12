import { Star, Trash2, Copy, Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { fetchFavoritesCached, removeFavorite } from '../services/favoritesService';
import type { FavoriteItem, FavoriteType } from '../types/api';
import { useLocale } from '../providers/LocaleContext';

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
      toast.error(t('favoritesClipboardUnsupported'), { id: 'clipboard' });
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
    <div className="h-full overflow-y-auto bg-surface">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-label mb-2">
            {t('favoritesTitle')}
          </h1>
          <p className="text-label-secondary">
            {t('favoritesSubtitle')}
          </p>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                selectedCategory === category.id
                  ? 'glass-button text-white'
                  : 'glass-card text-label-secondary hover:bg-fill'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass-card rounded-xl p-4">
                <div className="h-5 bg-fill rounded w-20 mb-3" />
                <div className="h-5 bg-fill rounded w-3/4 mb-2" />
                <div className="h-4 bg-fill rounded w-full mb-4" />
                <div className="h-3 bg-fill rounded w-24 mt-3 pt-3" />
              </div>
            ))}
          </div>
        ) : filteredFavorites.length === 0 ? (
          <div className="text-center py-16">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFavorites.map((favorite) => (
              <FavoriteCard
                key={favorite.id}
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
            ))}
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
    <div className="glass-card rounded-xl p-4 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between mb-3">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--color-primary-soft)] text-primary text-xs font-medium rounded-md">
          <Star className="w-3 h-3 fill-[var(--color-primary)]" />
          {categoryLabel}
        </span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onCopy(favorite.content, favorite.id)}
            className="p-1.5 hover:bg-fill rounded-lg transition-colors"
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
            className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors"
            title={removeLabel}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-lg font-medium text-label">
          {favorite.title}
        </p>
        <p className="text-sm text-label-secondary">
          {favorite.content}
        </p>
      </div>

      <div className="mt-3 pt-3 border-t border-separator">
        <p className="text-xs text-label-tertiary">
          {addedLabel} {createdAtLabel}
        </p>
      </div>
    </div>
  );
}
