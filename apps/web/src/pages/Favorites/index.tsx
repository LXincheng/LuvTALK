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
import { bookmarkOutline, chatbubbleEllipsesOutline, trashOutline } from 'ionicons/icons';
import { useEffect } from 'react';
import ThemeToggle from '../../components/ThemeToggle';
import AppDock from '../../components/navigation/AppDock';
import { FavoriteItem, FavoriteType } from '../../types/api';
import { useAppStore } from '../../store/useAppStore';
import './Favorites.css';

const labels: Record<FavoriteType, string> = {
  phrase: '语音片段',
  cultural: '文化提示',
  vocabulary: '词汇',
  scenario: '场景灵感',
};

const dockItems = [
  { label: 'AI 问答', icon: chatbubbleEllipsesOutline, href: '/' },
  { label: '收藏夹', icon: bookmarkOutline, href: '/favorites' },
];

const FavoritesPage = () => {
  const favorites = useAppStore(state => state.favorites);

  useEffect(() => {
    favorites.load();
  }, []);

  const renderCard = (item: FavoriteItem) => (
    <article key={item.id} className="favorite-card">
      <header>
        <div className="favorite-author">
          <img src={item.avatar} alt="avatar" />
          <div>
            <strong>{item.authorName ?? 'AI 导师'}</strong>
            <span>{new Date(item.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <IonChip color="light">{labels[item.type]}</IonChip>
      </header>
      <p>{item.content}</p>
      {item.metadata && (
        <small>
          {item.metadata.language ? `语言：${item.metadata.language}` : ''}
          {item.metadata.scenario ? ` · 场景：${item.metadata.scenario}` : ''}
        </small>
      )}
      <IonButton fill="clear" size="small" onClick={() => favorites.remove(item.id)}>
        <IonIcon icon={trashOutline} slot="icon-only" />
      </IonButton>
    </article>
  );

  return (
    <IonPage className="favorites-page">
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>收藏夹</IonTitle>
          <IonButtons slot="end">
            <ThemeToggle />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="favorites-content">
        <section className="favorites-hero">
          <div>
            <p>学习资产</p>
            <strong>{favorites.items.length.toString().padStart(2, '0')}</strong>
          </div>
          <IonText color="medium">收藏的文化提示、句型和语音片段都会保存在这里。</IonText>
        </section>

        {favorites.loading ? (
          <div className="favorites-loading">
            <IonSpinner name="crescent" />
            <p>正在同步收藏内容…</p>
          </div>
        ) : favorites.items.length ? (
          <div className="favorites-grid">{favorites.items.map(renderCard)}</div>
        ) : (
          <div className="favorites-empty-state">
            <IonIcon icon={bookmarkOutline} />
            <h2>点击 AI 回复旁的书签即可收藏</h2>
            <p>文化解释、语音片段都会自动同步到这里。</p>
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
