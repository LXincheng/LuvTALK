import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonPopover,
  IonSpinner,
  IonText,
  IonTextarea,
  IonToolbar,
} from "@ionic/react";
import {
  addOutline,
  arrowUpOutline,
  bookmarkOutline,
  bookOutline,
  chevronDownOutline,
  micOutline,
  sparklesOutline,
} from "ionicons/icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import ThemeToggle from "../../components/ThemeToggle";
import { useAppStore } from "../../store/useAppStore";
import { ConversationMessage } from "../../types/api";
import {
  LANGUAGE_LABELS,
  LanguageCode,
  UI_LANGUAGE_LABELS,
  UiLanguage,
  UI_LANGUAGE_TO_NATIVE,
} from "../../types/language";
import { useLocale } from "../../shared/i18n/LocaleProvider";
import {
  SCENARIO_IDS,
  SCENARIO_LABELS,
  ScenarioId,
} from "../../shared/constants/scenarios";
import "./Conversation.css";

const learningLanguageOrder: LanguageCode[] = [
  "cantonese",
  "english",
  "mandarin",
];

const ensureScenario = (value?: string): ScenarioId =>
  SCENARIO_IDS.includes(value as ScenarioId) ? (value as ScenarioId) : "daily";

const ConversationPage: React.FC = () => {
  const { scenarioId } = useParams<{ scenarioId?: ScenarioId }>();
  const { uiLanguage, setUiLanguage, t } = useLocale();
  const conversation = useAppStore((state) => state.conversation);
  const favorites = useAppStore((state) => state.favorites);

  const [learningLanguage, setLearningLanguage] = useState<LanguageCode>(
    learningLanguageOrder[0]
  );
  const [activeScenario, setActiveScenario] = useState<ScenarioId>(
    ensureScenario(scenarioId)
  );
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [languagePopoverEvent, setLanguagePopoverEvent] = useState<
    MouseEvent | undefined
  >(undefined);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [isAwaitingReply, setIsAwaitingReply] = useState(false);

  useEffect(() => {
    setActiveScenario(ensureScenario(scenarioId));
  }, [scenarioId]);

  useEffect(() => {
    const nativeLanguage = UI_LANGUAGE_TO_NATIVE[uiLanguage];
    conversation.start({
      scenarioId: activeScenario,
      targetLanguage: learningLanguage,
      nativeLanguage,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScenario, learningLanguage, uiLanguage]);

  useEffect(() => {
    if (!favorites.items.length) {
      favorites.load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const session = conversation.session;
  const messagesCount = session?.messages.length ?? 0;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !conversation.session) {
      return;
    }
    setInput("");
    setIsAwaitingReply(true);
    try {
      await conversation.send(text);
      setIsAwaitingReply(false);
    } catch {
      setInput(text);
      setIsAwaitingReply(false);
    }
  };

  const handleFavorite = async (message: ConversationMessage) => {
    await favorites.add({
      title: message.sender === "ai" ? "AI Reply" : "Learner Note",
      content: message.text,
      type: message.sender === "ai" ? "cultural" : "phrase",
      metadata: { language: message.language, scenario: activeScenario },
    });
  };

  const handleMicrophone = () => {
    setIsRecording((prev) => !prev);
    if (!isRecording) {
      setTimeout(() => {
        setIsRecording(false);
        setInput(t("conversationMicSeedText"));
      }, 1800);
    }
  };

  useEffect(() => {
    if (!messagesContainerRef.current) {
      return;
    }
    messagesContainerRef.current.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messagesCount]);

  useEffect(() => {
    if (!isAwaitingReply || !session?.messages?.length) {
      return;
    }
    const latest = session.messages[session.messages.length - 1];
    if (latest?.sender === "ai") {
      setIsAwaitingReply(false);
    }
  }, [isAwaitingReply, session?.id, session?.messages?.length]);

  useEffect(() => {
    if (!session) {
      setIsAwaitingReply(false);
    }
  }, [session?.id]);

  useEffect(() => {
    if (isAwaitingReply && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [isAwaitingReply]);

  useEffect(() => {
    if (conversation.error && isAwaitingReply) {
      setIsAwaitingReply(false);
    }
  }, [conversation.error, isAwaitingReply]);

  const scenarioName = SCENARIO_LABELS[uiLanguage][activeScenario];
  const learningLanguageLabel = LANGUAGE_LABELS[uiLanguage][learningLanguage];
  const latestAiMessage = useMemo(() => {
    if (!session?.messages?.length) {
      return undefined;
    }
    for (let index = session.messages.length - 1; index >= 0; index -= 1) {
      const candidate = session.messages[index];
      if (candidate.sender === "ai") {
        return candidate;
      }
    }
    return undefined;
  }, [session]);
  const pendingAssistantName =
    latestAiMessage?.senderName ?? t("navConversation");
  const pendingAssistantAvatar = latestAiMessage?.avatar;

  const openLanguageMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setLanguagePopoverEvent(event.nativeEvent);
  };

  const handleLanguageSelect = (language: LanguageCode) => {
    setLearningLanguage(language);
    setLanguagePopoverEvent(undefined);
  };

  const handleUiLanguageSelect = (language: UiLanguage) => {
    setUiLanguage(language);
    setLanguagePopoverEvent(undefined);
  };

  return (
    <IonPage className="conversation-page">
      <IonHeader>
        <IonToolbar className="conversation-toolbar">
          <IonButtons slot="start">
            <IonButton className="header-toggle-button" routerLink="/favorites" title={t('navFavorites')}>
              <IonIcon icon={bookOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <div className="conversation-brand">
            <button
              className="language-menu-trigger"
              type="button"
              onClick={openLanguageMenu}
            >
              <span>{t("conversationLanguageHeading")}</span>
              <strong>{learningLanguageLabel}</strong>
              <IonIcon icon={chevronDownOutline} />
            </button>
          </div>
          <IonButtons slot="end">
            <ThemeToggle />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonPopover
        isOpen={Boolean(languagePopoverEvent)}
        event={languagePopoverEvent}
        onDidDismiss={() => setLanguagePopoverEvent(undefined)}
        arrow={false}
        className="language-menu-popover"
      >
        <div className="language-menu">
          <section>
            <p>{t("conversationUiLanguageLabel")}</p>
            <div className="language-menu-options">
              {(["zh", "en"] as UiLanguage[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={uiLanguage === option ? "active" : ""}
                  onClick={() => handleUiLanguageSelect(option)}
                >
                  <span>{UI_LANGUAGE_LABELS[option]}</span>
                </button>
              ))}
            </div>
          </section>
          <section>
            <p>{t("conversationLanguageHeading")}</p>
            <div className="language-menu-options">
              {learningLanguageOrder.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={learningLanguage === option ? "active" : ""}
                  onClick={() => handleLanguageSelect(option)}
                >
                  <span>{LANGUAGE_LABELS[uiLanguage][option]}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </IonPopover>
      <IonContent fullscreen className="conversation-content" scrollY={false}>
        <div className="conversation-layout">
          <section className="scenario-panel glass-panel glass-panel-flat">
            <div className="scenario-line">
              <span>{t("conversationScenarioCurrentLabel")}</span>
              <strong>{scenarioName}</strong>
            </div>
            <div
              className="conversation-presets"
              role="tablist"
              aria-label={t("conversationScenarioAria")}
            >
              {SCENARIO_IDS.map((option) => (
                <IonChip
                  key={option}
                  color={activeScenario === option ? "primary" : "medium"}
                  onClick={() => setActiveScenario(option)}
                >
                  {SCENARIO_LABELS[uiLanguage][option]}
                </IonChip>
              ))}
            </div>
          </section>

          <section className="conversation-stream">
            {conversation.loading && !session && (
              <div className="conversation-loading">
                <IonSpinner name="crescent" />
                <p>{t("conversationLoading")}</p>
              </div>
            )}

            <div className="conversation-messages" ref={messagesContainerRef}>
              {session?.messages.map((message) => {
                const hasScore = Boolean(message.meta?.score);
                const senderLabel =
                  message.sender === "ai"
                    ? message.senderName ?? t("navConversation")
                    : message.senderName ??
                      (uiLanguage === "zh" ? "我" : "You");
                const avatarSrc =
                  message.avatar ??
                  (message.sender === "ai"
                    ? pendingAssistantAvatar ?? "/favicon.png"
                    : "/favicon.png");
                return (
                  <article
                    key={message.id}
                    className={`message-row message-${message.sender}`}
                  >
                    <img
                      src={avatarSrc}
                      alt={`${senderLabel} avatar`}
                      className="message-avatar"
                    />
                    <div className="message-bubble">
                      <div className="message-header">
                        <strong>{senderLabel}</strong>
                        <IonText color="medium">
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </IonText>
                      </div>
                      <div
                        className={`message-body ${
                          hasScore ? "" : "message-body-inline"
                        }`}
                      >
                        <div className="message-text">
                          <p>{message.text}</p>
                          {message.meta?.translation && (
                            <p className="message-translation">
                              {message.meta.translation}
                            </p>
                          )}
                        </div>
                        {!hasScore && (
                          <IonButton
                            fill="clear"
                            size="small"
                            className="message-favorite-inline"
                            onClick={() => handleFavorite(message)}
                            title={t("conversationFavoriteButton")}
                          >
                            <IonIcon icon={bookmarkOutline} />
                          </IonButton>
                        )}
                      </div>
                      {hasScore && (
                        <div className="message-meta">
                          <span className="message-score">
                            <IonIcon icon={sparklesOutline} />
                            {message.meta?.score}
                            {message.meta?.scoreReason
                              ? ` - ${message.meta?.scoreReason}`
                              : ""}
                          </span>
                          <IonButton
                            fill="clear"
                            size="small"
                            onClick={() => handleFavorite(message)}
                            title={t("conversationFavoriteButton")}
                          >
                            <IonIcon icon={bookmarkOutline} />
                          </IonButton>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
              {isAwaitingReply && (
                <article className="message-row message-ai message-pending">
                  {pendingAssistantAvatar ? (
                    <img
                      src={pendingAssistantAvatar}
                      alt={`${pendingAssistantName} avatar`}
                      className="message-avatar"
                    />
                  ) : (
                    <div className="message-avatar placeholder-avatar">
                      <IonIcon icon={sparklesOutline} />
                    </div>
                  )}
                  <div className="message-bubble pending-bubble">
                    <div className="message-header">
                      <strong>{pendingAssistantName}</strong>
                    </div>
                    <div className="message-loading-indicator">
                      <IonSpinner name="crescent" />
                    </div>
                  </div>
                </article>
              )}
            </div>
          </section>
        </div>
      </IonContent>
      <div className="conversation-composer glass-panel">
        <div className="composer-inner">
          <button
            type="button"
            className="composer-icon-button"
            title={t("conversationMicSeedText")}
            aria-label={t("conversationMicSeedText")}
          >
            <IonIcon icon={addOutline} />
          </button>
          <div
            className={`conversation-input-row ${
              isRecording ? "recording" : ""
            }`}
          >
            <IonTextarea
              autoGrow
              rows={1}
              value={input}
              placeholder={t("conversationInputPlaceholder")}
              onIonChange={(event) => setInput(event.detail.value ?? "")}
            />
          </div>
          <div className="conversation-input-actions">
            <button
              type="button"
              className="composer-icon-button"
              onClick={handleMicrophone}
              aria-pressed={isRecording}
              aria-label={t("conversationMicSeedText")}
            >
              <IonIcon icon={micOutline} />
            </button>
            <button
              type="button"
              className="composer-icon-button"
              onClick={handleSend}
              disabled={!session || !input.trim() || isAwaitingReply}
              aria-label={"Send message"}
            >
              <IonIcon icon={arrowUpOutline} />
            </button>
          </div>
        </div>
      </div>
    </IonPage>
  );
};

export default ConversationPage;
