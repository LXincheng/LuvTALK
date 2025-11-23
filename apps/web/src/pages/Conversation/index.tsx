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
  IonToast,
  IonToolbar,
} from "@ionic/react";
import {
  addOutline,
  arrowUpOutline,
  bookmarkOutline,
  bookOutline,
  chevronDownOutline,
  closeOutline,
  micOutline,
  sparklesOutline,
  volumeHighOutline,
} from "ionicons/icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useVoiceRecorder } from "../../hooks/useVoiceRecorder";
import { API_BASE_URL } from "../../services/apiClient";
import { synthesizeTutorSpeech } from "../../services/conversationService";
import "./Conversation.css";

const learningLanguageOrder: LanguageCode[] = [
  "cantonese",
  "english",
  "mandarin",
];

type TtsEntry = {
  status: "idle" | "loading" | "ready" | "error";
  audioUrl?: string;
};

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
  const [languagePopoverEvent, setLanguagePopoverEvent] = useState<
    MouseEvent | undefined
  >(undefined);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [isAwaitingReply, setIsAwaitingReply] = useState(false);
  const [favoriteToast, setFavoriteToast] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);
  const [ttsEntries, setTtsEntries] = useState<Record<string, TtsEntry>>({});
  const [voiceToast, setVoiceToast] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);
  const [voiceUploadStatus, setVoiceUploadStatus] = useState<
    "idle" | "uploading"
  >("idle");
  const {
    isSupported: isRecorderSupported,
    isRecording,
    start: startVoiceRecording,
    stop: stopVoiceRecording,
    reset: resetVoiceRecorder,
    memo: voiceMemo,
    error: recorderError,
    permissionDenied,
  } = useVoiceRecorder();

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

  useEffect(() => {
    if (!composerInputRef.current) {
      return;
    }
    const element = composerInputRef.current;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [input]);

  const session = conversation.session;
  const messagesCount = session?.messages.length ?? 0;

  const handleSend = async () => {
    if (!conversation.session || isAwaitingReply) {
      return;
    }
    if (voiceMemo) {
      setVoiceUploadStatus("uploading");
      setIsAwaitingReply(true);
      try {
        await conversation.sendVoice(voiceMemo.blob);
        setVoiceUploadStatus("idle");
        setVoiceToast({
          status: "success",
          message: t("conversationVoiceUploadSuccess"),
        });
        resetVoiceRecorder();
      } catch {
        setVoiceUploadStatus("idle");
        setIsAwaitingReply(false);
        setVoiceToast({
          status: "error",
          message: t("conversationVoiceSendError"),
        });
      }
      return;
    }
    const text = input.trim();
    if (!text) {
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
    try {
      const created = await favorites.add({
        title: message.sender === "ai" ? "AI Reply" : "Learner Note",
        content: message.text,
        type: message.sender === "ai" ? "cultural" : "phrase",
        metadata: { language: message.language, scenario: activeScenario },
      });
      setFavoriteToast({
        status: created ? "success" : "error",
        message: created ? t("favoritesAddSuccess") : t("favoritesAddError"),
      });
    } catch {
      setFavoriteToast({
        status: "error",
        message: t("favoritesAddError"),
      });
    }
  };

  const handleMicrophone = async () => {
    if (voiceUploadStatus === "uploading") {
      return;
    }
    if (!isRecorderSupported) {
      setVoiceToast({
        status: "error",
        message: t("conversationVoiceNotSupported"),
      });
      return;
    }
    if (isRecording) {
      stopVoiceRecording();
      setVoiceToast({
        status: "success",
        message: t("conversationVoiceRecordingStopped"),
      });
      return;
    }
    const started = await startVoiceRecording();
    if (started) {
      setVoiceToast({
        status: "success",
        message: t("conversationVoiceRecordingStarted"),
      });
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
  }, [isAwaitingReply, session]);

  useEffect(() => {
    if (!session) {
      setIsAwaitingReply(false);
    }
  }, [session]);

  useEffect(() => {
    setTtsEntries({});
  }, [session?.id]);

  useEffect(() => {
    if (permissionDenied) {
      setVoiceToast({
        status: "error",
        message: t("conversationVoicePermissionDenied"),
      });
      return;
    }
    if (recorderError) {
      setVoiceToast({
        status: "error",
        message: t("conversationVoiceGenericError"),
      });
    }
  }, [permissionDenied, recorderError, t]);

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

  const requestTutorAudio = async (message: ConversationMessage) => {
    if (!conversation.session) {
      return;
    }
    const current = ttsEntries[message.id];
    if (current?.status === "loading") {
      return;
    }
    if (current?.status === "ready" && current.audioUrl) {
      return;
    }
    setTtsEntries((prev) => ({
      ...prev,
      [message.id]: { status: "loading" },
    }));
    try {
      const payload = await synthesizeTutorSpeech(conversation.session.id, {
        text: message.text,
      });
      setTtsEntries((prev) => ({
        ...prev,
        [message.id]: { status: "ready", audioUrl: payload.audioUrl },
      }));
    } catch {
      setTtsEntries((prev) => ({
        ...prev,
        [message.id]: { status: "error" },
      }));
      setVoiceToast({
        status: "error",
        message: t("conversationVoiceTtsError"),
      });
    }
  };

  const resolveAudioUrl = useCallback((path?: string) => {
    if (!path) {
      return undefined;
    }
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    if (API_BASE_URL.startsWith("http")) {
      try {
        return new URL(path, API_BASE_URL).toString();
      } catch {
        return path;
      }
    }
    return path;
  }, []);

  const showVoiceDraft = Boolean(voiceMemo);

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
                const ttsEntry = ttsEntries[message.id];
                const userAudioUrl = resolveAudioUrl(message.meta?.audioUrl);
                const tutorAudioUrl =
                  message.sender === "ai" && ttsEntry?.audioUrl
                    ? resolveAudioUrl(ttsEntry.audioUrl)
                    : undefined;
                const audioSources: string[] = [];
                if (userAudioUrl) {
                  audioSources.push(userAudioUrl);
                }
                if (
                  tutorAudioUrl &&
                  !audioSources.includes(tutorAudioUrl)
                ) {
                  audioSources.push(tutorAudioUrl);
                }
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
                          {audioSources.map((source, index) => (
                            <div
                              className="message-audio"
                              key={`${message.id}-audio-${index}`}
                            >
                              <audio controls src={source} preload="none" />
                            </div>
                          ))}
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
                            className="message-tts-button"
                            onClick={() => requestTutorAudio(message)}
                            disabled={ttsEntry?.status === "loading"}
                            title={t("conversationVoiceTtsButton")}
                          >
                            {ttsEntry?.status === "loading" ? (
                              <>
                                <IonSpinner
                                  name="crescent"
                                  className="message-tts-spinner"
                                />
                                <span>{t("conversationVoiceTtsFetching")}</span>
                              </>
                            ) : (
                              <>
                                <IonIcon icon={volumeHighOutline} />
                                <span>{t("conversationVoiceTtsButton")}</span>
                              </>
                            )}
                          </IonButton>
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
      <IonToast
        isOpen={Boolean(favoriteToast)}
        message={favoriteToast?.message ?? ""}
        duration={500}
        onDidDismiss={() => setFavoriteToast(null)}
        className={`conversation-toast ${favoriteToast?.status ?? "success"}`}
        position="top"
      />
      <IonToast
        isOpen={Boolean(voiceToast)}
        message={voiceToast?.message ?? ""}
        duration={800}
        onDidDismiss={() => setVoiceToast(null)}
        className={`conversation-toast ${voiceToast?.status ?? "success"}`}
        position="top"
      />
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
            } ${showVoiceDraft ? "has-voice-draft" : ""}`}
          >
            {voiceMemo ? (
              <div className="voice-memo-inline">
                <div className="voice-memo-icon">
                  <IonIcon icon={micOutline} />
                </div>
                <div className="voice-memo-inline-body">
                  <p>
                    {t("conversationVoicePreviewHeading", {
                      seconds: Math.max(
                        1,
                        Math.round(voiceMemo.durationMs / 1000)
                      ),
                    })}
                  </p>
                  <audio controls src={voiceMemo.url} preload="metadata" />
                  <p className="voice-memo-transcript">
                    {voiceUploadStatus === "uploading"
                      ? t("conversationVoiceUploadPending")
                      : t("conversationVoicePreviewNote")}
                  </p>
                </div>
                <button
                  type="button"
                  className="voice-memo-dismiss"
                  onClick={() => {
                    if (voiceUploadStatus === "uploading") {
                      return;
                    }
                    setVoiceUploadStatus("idle");
                    resetVoiceRecorder();
                  }}
                  aria-label={t("conversationVoiceDiscard")}
                >
                  <IonIcon icon={closeOutline} />
                </button>
              </div>
            ) : (
              <textarea
                ref={composerInputRef}
                className="conversation-textarea"
                rows={1}
                value={input}
                placeholder={t("conversationInputPlaceholder")}
                onChange={(event) => setInput(event.target.value)}
                aria-label={t("conversationInputPlaceholder")}
              />
            )}
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
              disabled={
                !session ||
                (!input.trim() && !voiceMemo) ||
                isAwaitingReply ||
                voiceUploadStatus === "uploading"
              }
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
