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
  IonToast,
  IonToolbar,
} from "@ionic/react";
import { bookOutline, homeOutline, trashOutline } from "ionicons/icons";
import { useEffect, useState } from "react";
import ThemeToggle from "../../components/ThemeToggle";
import { useAuthStore } from "../../store/useAuthStore";
import { FavoriteItem, FavoriteType } from "../../types/api";
import { useAppStore } from "../../store/useAppStore";
import { useLocale } from "../../shared/i18n/LocaleProvider";
import "./Favorites.css";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

const typeLabelKeys: Record<
  FavoriteType,
  | "favoriteTypePhrase"
  | "favoriteTypeCultural"
  | "favoriteTypeVocabulary"
  | "favoriteTypeScenario"
> = {
  phrase: "favoriteTypePhrase",
  cultural: "favoriteTypeCultural",
  vocabulary: "favoriteTypeVocabulary",
  scenario: "favoriteTypeScenario",
};

const FavoritesPage = () => {
  const favorites = useAppStore((state) => state.favorites);
  const authStatus = useAuthStore((state) => state.status);
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = authStatus === "authenticated";
  const isAuthLoading = authStatus === "loading" || authStatus === "unknown";
  const [toast, setToast] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);
  const { t } = useLocale();

  useEffect(() => {
    if (isAuthenticated) {
      favorites.load();
    }
  }, [isAuthenticated]);

  const renderCard = (item: FavoriteItem) => {
    const audioUrl =
      typeof item.metadata?.audioUrl === "string"
        ? (item.metadata.audioUrl as string)
        : undefined;
    const scoreValue =
      typeof item.metadata?.score === "number"
        ? (item.metadata.score as number)
        : undefined;
    const scoreReason =
      typeof item.metadata?.scoreReason === "string"
        ? (item.metadata.scoreReason as string)
        : undefined;

    return (
      <article
        key={item.id}
        className="favorite-card glass-panel glass-panel-flat"
      >
        <header>
          <div className="favorite-author">
            <img src={item.avatar ?? "/favicon.png"} alt="avatar" />
            <div>
              <strong>{item.authorName ?? "AI Tutor"}</strong>
              <span style={{ padding: "0.2rem" }}>
                {formatDate(item.createdAt)}
              </span>
            </div>
          </div>
          <IonChip style={{ fontSize: "0.7rem" }}>
            {t(typeLabelKeys[item.type])}
          </IonChip>
        </header>
        <p>{item.content}</p>
        {audioUrl && (
          <div className="favorite-audio">
            <audio controls src={audioUrl} preload="none" />
          </div>
        )}
        {typeof scoreValue === "number" && (
          <div className="favorite-score">
            <strong>
              {t("conversationCoachScore")}: {scoreValue}
            </strong>
            {scoreReason && <p>{scoreReason}</p>}
          </div>
        )}
        <div className="favorite-meta">
          {item.metadata && (
            <small>
              {item.metadata.language
                ? `${t("labelLanguage")}: ${item.metadata.language}`
                : ""}
              {item.metadata.language && item.metadata.scenario ? " / " : ""}
              {item.metadata.scenario
                ? `${t("labelScenario")}: ${item.metadata.scenario}`
                : ""}
            </small>
          )}
          <IonButton
            fill="clear"
            size="small"
            onClick={async () => {
              const removed = await favorites.remove(item.id);
              setToast({
                status: removed ? "success" : "error",
                message: removed
                  ? t("favoritesRemoveSuccess")
                  : t("favoritesRemoveError"),
              });
            }}
            title={t("favoritesRemoveButton")}
          >
            <IonIcon icon={trashOutline} slot="icon-only" />
          </IonButton>
        </div>
      </article>
    );
  };

  return (
    <IonPage className="favorites-page">
      <IonHeader translucent={false}>
        <IonToolbar className="favorites-toolbar">
          <IonButtons slot="start">
            <IonButton
              className="header-toggle-button"
              routerLink="/"
              routerDirection="back"
              title={t("navConversation")}
            >
              <IonIcon icon={homeOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>{t("favoritesTitle")}</IonTitle>
          <IonButtons slot="end">
            <ThemeToggle />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="favorites-content">
        <IonToast
          isOpen={Boolean(toast)}
          message={toast?.message ?? ""}
          duration={500}
          onDidDismiss={() => setToast(null)}
          className={`conversation-toast ${toast?.status ?? "success"}`}
          position="top"
        />
        <section className="favorites-hero glass-panel glass-panel-flat">
          <div className="favorites-hero-line">
            <span>{t("favoritesHeroLabel")}</span>
            <strong>
              {(isAuthenticated ? favorites.items.length : 0)
                .toString()
                .padStart(2, "0")}
            </strong>
          </div>
          <p>{t("favoritesHeroDescription")}</p>
        </section>

        {!isAuthenticated ? (
          <div className="favorites-empty-state login-gate">
            <IonIcon icon={bookOutline} />
            <h2>{t("authLoginRequired")}</h2>
            <p>{t("favoritesHeroDescription")}</p>
            <IonButton
              onClick={login}
              disabled={isAuthLoading}
              className="login-gate-button"
            >
              {t("authLoginButton")}
            </IonButton>
          </div>
        ) : favorites.loading ? (
          <div className="favorites-loading">
            <IonSpinner name="crescent" />
            <p>{t("favoritesLoading")}</p>
          </div>
        ) : favorites.items.length ? (
          <div className="favorites-grid">
            {favorites.items.map(renderCard)}
          </div>
        ) : (
          <div className="favorites-empty-state">
            <IonIcon icon={bookOutline} />
            <h2>{t("favoritesEmptyTitle")}</h2>
            <p>{t("favoritesEmptyDescription")}</p>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default FavoritesPage;
