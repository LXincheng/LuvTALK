import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { bookOutline, homeOutline, trashOutline } from 'ionicons/icons';
import { useEffect } from 'react';
import ThemeToggle from '../../components/ThemeToggle';
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

const FavoritesPage = () => {
  const favorites = useAppStore(state => state.favorites);
  const { t } = useLocale();

  useEffect(() => {
    favorites.load();
  }, []);

  const renderCard = (item: FavoriteItem) => (
    <article key={item.id} className="favorite-card glass-panel glass-panel-flat">
      <header>
        <div className="favorite-author">
          <img src={item.avatar} alt="avatar" />
          <div>
            <strong>{item.authorName ?? 'AI Tutor'}</strong>
            <span style={{padding:'0.2rem'}}>{formatDate(item.createdAt)}</span>
          </div>
        </div>
        <IonChip>{t(typeLabelKeys[item.type])}</IonChip>
      </header>
      <p>{item.content}</p>
      <div className="favorite-meta">
        {item.metadata && (
          <small>
            {item.metadata.language ? `${t('labelLanguage')}: ${item.metadata.language}` : ''}
            {item.metadata.language && item.metadata.scenario ? ' / ' : ''}
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
      <IonHeader translucent={false}>
        <IonToolbar className="favorites-toolbar">
          <IonButtons slot="start">
            <IonButton
              className="header-toggle-button"
              routerLink="/"
              routerDirection="back"
              title={t('navConversation')}
            >
              <IonIcon icon={homeOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>{t('favoritesTitle')}</IonTitle>
          <IonButtons slot="end">
            <ThemeToggle />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="favorites-content">
        <section className="favorites-hero glass-panel glass-panel-flat">
          <div className="favorites-hero-line">
            <span>{t('favoritesHeroLabel')}</span>
            <strong>{favorites.items.length.toString().padStart(2, '0')}</strong>
          </div>
          <p>{t('favoritesHeroDescription')}</p>
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
            <IonIcon icon={bookOutline} />
            <h2>{t('favoritesEmptyTitle')}</h2>
            <p>{t('favoritesEmptyDescription')}</p>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default FavoritesPage;
