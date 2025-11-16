import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { bookOutline, trashOutline, sparklesOutline } from 'ionicons/icons';
import { useEffect } from 'react';
import ThemeToggle from '../../components/ThemeToggle';
import AppDock, { DockItem } from '../../components/navigation/AppDock';
import { FavoriteItem, FavoriteType } from '../../types/api';
import { useAppStore } from '../../store/useAppStore';
import { useLocale } from '../../shared/i18n/LocaleProvider';
import './Favorites.css';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });

const typeLabelKeys: Record<FavoriteType, 'favoriteTypePhrase' | 'favoriteTypeCultural' | 'favoriteTypeVocabulary' | 'favoriteTypeScenario'> = {
  phrase: 'favoriteTypePhrase',
  cultural: 'favoriteTypeCultural',
  vocabulary: 'favoriteTypeVocabulary',
  scenario: 'favoriteTypeScenario',
};

const dockItems: DockItem[] = [
  { labelKey: 'navConversation', icon: sparklesOutline, href: '/' },
  { labelKey: 'navFavorites', icon: bookOutline, href: '/favorites' },
];

const FavoritesPage = () => {
  const favorites = useAppStore(state => state.favorites);
  const { t } = useLocale();

  useEffect(() => {
    favorites.load();
  }, []);

  const renderCard = (item: FavoriteItem) => (
    <article key={item.id} className="favorite-card">
      <header>
        <div className="favorite-author">
          <img src={item.avatar} alt="avatar" />
          <div>
            <strong>{item.authorName ?? 'AI Tutor'}</strong>
            <span>{formatDate(item.createdAt)}</span>
          </div>
        </div>
        <IonChip color="light">{t(typeLabelKeys[item.type])}</IonChip>
      </header>
      <p>{item.content}</p>
      <div className="favorite-meta">
        {item.metadata && (
          <small>
            {item.metadata.language ? `${t('labelLanguage')}: ${item.metadata.language}` : ''}
            {item.metadata.language && item.metadata.scenario ? ' · ' : ''}
            {item.metadata.scenario ? `${t('labelScenario')}: ${item.metadata.scenario}` : ''}
          </small>
        )}
        <IonButton
          fill="clear"
          size="small"
          onClick={() => favorites.remove(item.id)}
          title={t('favoritesRemoveButton')}
        >
          <IonIcon icon={trashOutline} slot="icon-only" />
        </IonButton>
      </div>
    </article>
  );

  return (
    <IonPage className="favorites-page">
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>{t('favoritesTitle')}</IonTitle>
          <IonButtons slot="end">
            <ThemeToggle />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="favorites-content">
        <section className="favorites-hero">
          <div>
            <p>{t('favoritesHeroLabel')}</p>
            <strong>{favorites.items.length.toString().padStart(2, '0')}</strong>
          </div>
          <IonText color="medium">{t('favoritesHeroDescription')}</IonText>
        </section>

        {favorites.loading ? (
          <div className="favorites-loading">
            <IonSpinner name="crescent" />
            <p>{t('favoritesLoading')}</p>
          </div>
        ) : favorites.items.length ? (
          <div className="favorites-grid">{favorites.items.map(renderCard)}</div>
        ) : (
          <div className="favorites-empty-state">
            <IonIcon icon={bookmarkOutline} />
            <h2>{t('favoritesEmptyTitle')}</h2>
            <p>{t('favoritesEmptyDescription')}</p>
          </div>
        )}
      </IonContent>
      <IonFooter>
        <div className="favorites-footer">
          <AppDock items={dockItems} active="/favorites" />
        </div>
      </IonFooter>
    </IonPage>
  );
};

export default FavoritesPage;
