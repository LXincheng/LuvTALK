import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonPopover,
  IonSpinner,
  IonText,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import {
  arrowUpOutline,
  bookmarkOutline,
  bookOutline,
  chevronDownOutline,
  closeOutline,
  logInOutline,
  logOutOutline,
  medalOutline,
  menuOutline,
  micOutline,
  pauseOutline,
  personCircleOutline,
  playOutline,
  sparklesOutline,
  timeOutline,
} from "ionicons/icons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router";
import ThemeToggle from "../../components/ThemeToggle";
import { useAppStore } from "../../store/useAppStore";
import { useAuthStore } from "../../store/useAuthStore";
import { ConversationMessage, ConversationSession } from "../../types/api";
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
import {
  historyService,
  ConversationHistoryItem,
} from "../../services/historyService";
import {
  VOICE_TEXT_KEYS,
  VOICE_UI_CONSTANTS,
} from "../../shared/constants/voice-ui";
import "./Conversation.css";

const formatDuration = (value: number) => {
  if (!Number.isFinite(value) || value < 0) {
    return "0:00";
  }
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

interface MessageAudioPlayerProps {
  src: string;
}

const MessageAudioPlayer: React.FC<MessageAudioPlayerProps> = ({ src }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const element = audioRef.current;
    if (element) {
      element.pause();
      element.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setProgress(0);
    return () => {
      element?.pause();
    };
  }, [src]);

  const syncTimeline = useCallback(() => {
    const element = audioRef.current;
    if (!element) {
      return;
    }
    const { currentTime: current, duration: total } = element;
    setCurrentTime(current);
    setDuration(Number.isFinite(total) ? total : 0);
    const ratio =
      total && Number.isFinite(total) ? Math.min(current / total, 1) : 0;
    setProgress(ratio * 100);
  }, []);

  const togglePlayback = useCallback(() => {
    const element = audioRef.current;
    if (!element) {
      return;
    }
    if (element.paused) {
      void element
        .play()
        .catch(() => {
          element.pause();
          setIsPlaying(false);
        });
      return;
    }
    element.pause();
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setProgress(0);
  }, []);

  const currentLabel = formatDuration(currentTime);
  const durationLabel = duration > 0 ? formatDuration(duration) : "--:--";

  return (
    <div className="message-audio-player">
      <button
        type="button"
        className={`message-audio-button ${isPlaying ? "is-playing" : ""}`}
        onClick={togglePlayback}
        aria-label={isPlaying ? "Pause voice clip" : "Play voice clip"}
      >
        <IonIcon icon={isPlaying ? pauseOutline : playOutline} />
      </button>
      <div className="message-audio-track" role="presentation">
        <div
          className="message-audio-progress"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="message-audio-time">
        {currentLabel} / {durationLabel}
      </span>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={syncTimeline}
        onLoadedMetadata={syncTimeline}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        className="message-audio-hidden"
      />
    </div>
  );
};

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
  const authStatus = useAuthStore((state) => state.status);
  const authProfile = useAuthStore((state) => state.profile);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);

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
  const [pendingVoicePreview, setPendingVoicePreview] = useState<{
    url: string;
    createdAt: string;
  } | null>(null);
  const [scorePanels, setScorePanels] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<ConversationHistoryItem[]>(
    [],
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedHistory, setSelectedHistory] =
    useState<ConversationSession | null>(null);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);
  const [authToast, setAuthToast] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);
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

  const showVoiceDraft = Boolean(voiceMemo);
  const autoGeneratedTtsRef = useRef(new Set<string>());
  const isAuthBusy = authStatus === "loading" || authStatus === "unknown";
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

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
  const sessionId = session?.id;
  const messagesCount = session?.messages.length ?? 0;

  const handleSend = async () => {
    if (!conversation.session || isAwaitingReply) {
      return;
    }
    if (voiceMemo) {
      setVoiceUploadStatus("uploading");
      setIsAwaitingReply(true);
      const previewUrl = URL.createObjectURL(voiceMemo.blob);
      setPendingVoicePreview({
        url: previewUrl,
        createdAt: new Date().toISOString(),
      });
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
        setPendingVoicePreview(null);
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
    if (authStatus !== "authenticated") {
      setFavoriteToast({
        status: "error",
        message: t("authLoginRequired"),
      });
      return;
    }
    const metadata: Record<string, string | number> = {
      language: message.language,
      scenario: activeScenario,
    };
    if (message.meta?.audioUrl) {
      metadata.audioUrl = message.meta.audioUrl;
    }
    if (typeof message.meta?.score === "number") {
      metadata.score = message.meta.score;
    }
    if (message.meta?.scoreReason) {
      metadata.scoreReason = message.meta.scoreReason;
    }
    try {
      const created = await favorites.add({
        title: message.sender === "ai" ? "AI Reply" : "Learner Note",
        content: message.text,
        type: message.sender === "ai" ? "cultural" : "phrase",
        metadata,
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

  const toggleScorePanel = (messageId: string) => {
    setScorePanels((previous) => ({
      ...previous,
      [messageId]: !previous[messageId],
    }));
  };

  const requestTutorAudio = useCallback(
    async (message: ConversationMessage, options?: { auto?: boolean }) => {
      if (!sessionId) {
        return;
      }
      const current = ttsEntries[message.id];
      if (current?.status === "loading") {
        return;
      }
      if (current?.status === "ready" && current.audioUrl) {
        return;
      }
      if (options?.auto) {
        autoGeneratedTtsRef.current.add(message.id);
      }
      setTtsEntries((prev) => ({
        ...prev,
        [message.id]: { status: "loading" },
      }));
      try {
        const payload = await synthesizeTutorSpeech(sessionId, {
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
        if (options?.auto) {
          autoGeneratedTtsRef.current.delete(message.id);
        } else {
          setVoiceToast({
            status: "error",
            message: t("conversationVoiceTtsError"),
          });
        }
      }
    },
    [sessionId, ttsEntries, t]
  );

  const handleToggleRecording = useCallback(async () => {
    if (voiceUploadStatus === "uploading" || showVoiceDraft) {
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
  }, [
    isRecording,
    isRecorderSupported,
    showVoiceDraft,
    startVoiceRecording,
    stopVoiceRecording,
    t,
    voiceUploadStatus,
  ]);

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

  const describeScenarioLabel = useCallback(
    (value: string) =>
      SCENARIO_LABELS[uiLanguage][value as ScenarioId] ?? value,
    [uiLanguage],
  );

  const handleGoogleLogin = useCallback(async () => {
    try {
      await login();
      setAuthToast({
        status: "success",
        message: t("authLoginSuccess"),
      });
    } catch (error) {
      setAuthToast({
        status: "error",
        message:
          error instanceof Error ? error.message : t("authLoginError"),
      });
    }
  }, [login, t]);

  const handleLogout = useCallback(() => {
    historyService.clearCache();
    logout();
    setHistoryItems([]);
    setSelectedHistory(null);
    closeSidebar();
    setAuthToast({
      status: "success",
      message: t("authLogoutSuccess"),
    });
  }, [closeSidebar, logout, t]);

  const handleSelectHistoryItem = useCallback(
    async (conversationId: string) => {
      if (authStatus !== "authenticated") {
        setAuthToast({
          status: "error",
          message: t("authLoginRequired"),
        });
        return;
      }
      setHistoryDetailLoading(true);
      try {
        const sessionData = await historyService.getConversation(
          conversationId,
        );
        setSelectedHistory(sessionData);
        setHistoryError(null);
      } catch (error) {
        setHistoryError(
          error instanceof Error ? error.message : t("authHistoryError"),
        );
      } finally {
        setHistoryDetailLoading(false);
      }
    },
    [authStatus, t],
  );

  const handleLanguageSelect = (language: LanguageCode) => {
    setLearningLanguage(language);
    setLanguagePopoverEvent(undefined);
  };

  const handleUiLanguageSelect = (language: UiLanguage) => {
    setUiLanguage(language);
    setLanguagePopoverEvent(undefined);
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

  const showPendingTutorBubble =
    isAwaitingReply || voiceUploadStatus === "uploading";
  const composerRecordingClass = isRecording ? "recording" : "";

  useEffect(() => {
    if (!messagesContainerRef.current) {
      return;
    }
    messagesContainerRef.current.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messagesCount]);

  const lastAiMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session?.messages?.length) {
      lastAiMessageRef.current = null;
      return;
    }
    const latestAi = [...session.messages]
      .reverse()
      .find((message) => message.sender === "ai");
    if (!latestAi) {
      lastAiMessageRef.current = null;
      return;
    }
    if (lastAiMessageRef.current !== latestAi.id) {
      if (isAwaitingReply) {
        setIsAwaitingReply(false);
        setPendingVoicePreview(null);
      }
      lastAiMessageRef.current = latestAi.id;
    } else if (!lastAiMessageRef.current) {
      lastAiMessageRef.current = latestAi.id;
    }
  }, [sessionId, session?.messages, isAwaitingReply]);

  useEffect(() => {
    if (!session) {
      setIsAwaitingReply(false);
      setPendingVoicePreview(null);
    }
  }, [session]);

  useEffect(() => {
    autoGeneratedTtsRef.current.clear();
    setTtsEntries({});
  }, [sessionId]);

  useEffect(() => {
    setScorePanels({});
  }, [sessionId]);

  useEffect(() => {
    if (!pendingVoicePreview || !messagesContainerRef.current) {
      return;
    }
    messagesContainerRef.current.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [pendingVoicePreview]);

  useEffect(() => {
    if (!showPendingTutorBubble || !messagesContainerRef.current) {
      return;
    }
    messagesContainerRef.current.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [showPendingTutorBubble]);

  useEffect(() => {
    if (!pendingVoicePreview) {
      return undefined;
    }
    return () => {
      URL.revokeObjectURL(pendingVoicePreview.url);
    };
  }, [pendingVoicePreview]);

  useEffect(() => {
    if (!pendingVoicePreview || !session?.messages?.length) {
      return;
    }
    const latestUser = [...session.messages]
      .reverse()
      .find((message) => message.sender === "user");
    if (!latestUser) {
      return;
    }
    if (
      new Date(latestUser.createdAt).getTime() >=
      new Date(pendingVoicePreview.createdAt).getTime()
    ) {
      setPendingVoicePreview(null);
    }
  }, [session?.messages, pendingVoicePreview]);

  useEffect(() => {
    if (!sessionId || !session?.messages?.length) {
      return;
    }
    session.messages.forEach((message) => {
      if (message.sender !== "ai") {
        return;
      }
      if (autoGeneratedTtsRef.current.has(message.id)) {
        return;
      }
      autoGeneratedTtsRef.current.add(message.id);
      void requestTutorAudio(message, { auto: true });
    });
  }, [sessionId, session?.messages, requestTutorAudio]);

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

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }
    if (authStatus !== "authenticated") {
      setHistoryLoading(false);
      setHistoryError(null);
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    setSelectedHistory(null);
    historyService
      .list()
      .then((items) => {
        setHistoryItems(items);
        if (!items.length) {
          setHistoryError(t("authHistoryEmpty"));
        }
      })
      .catch((error) => {
        setHistoryError(
          error instanceof Error ? error.message : t("authHistoryError"),
        );
      })
      .finally(() => {
        setHistoryLoading(false);
      });
  }, [sidebarOpen, authStatus, t]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setHistoryItems([]);
      setSelectedHistory(null);
      historyService.clearCache();
    }
  }, [authStatus]);

  useEffect(() => {
    if (!sidebarOpen) {
      setSelectedHistory(null);
      setHistoryDetailLoading(false);
    }
  }, [sidebarOpen]);

  return (
    <IonPage className="conversation-page">
      <IonHeader>
        <IonToolbar className="conversation-toolbar">
          <IonButtons slot="start">
            <IonButton
              className="header-toggle-button"
              onClick={() => setSidebarOpen(true)}
              title={t("authHistoryButton")}
            >
              <IonIcon icon={menuOutline} slot="icon-only" />
            </IonButton>
            <IonButton
              className="header-toggle-button"
              routerLink="/favorites"
              title={t("navFavorites")}
            >
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
      <IonContent fullscreen className="conversation-content">
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
                if (tutorAudioUrl && !audioSources.includes(tutorAudioUrl)) {
                  audioSources.push(tutorAudioUrl);
                }
                const hasAudioAttachment = audioSources.length > 0;
                const bubbleClassName = `message-bubble${
                  hasAudioAttachment ? " has-audio" : ""
                }`;
                const senderLabel =
                  message.sender === "ai"
                    ? message.senderName ?? t("navConversation")
                    : message.senderName ?? (uiLanguage === "zh" ? "我" : "You");
                const avatarSrc =
                  message.avatar ??
                  (message.sender === "ai"
                    ? pendingAssistantAvatar ?? "/favicon.png"
                    : "/favicon.png");
                const isScoreExpanded = Boolean(scorePanels[message.id]);
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
                    <div className={bubbleClassName}>
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
                              <MessageAudioPlayer src={source} />
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
                        <>
                          <div className="message-meta score-meta">
                            <button
                              type="button"
                              className={`score-pill ${
                                isScoreExpanded ? "expanded" : ""
                              }`}
                              onClick={() => toggleScorePanel(message.id)}
                            >
                              <span className="message-score">
                                <IonIcon icon={medalOutline} />
                                <span className="message-score-label">
                                  {t("conversationCoachScore")}
                                </span>
                                <strong>{message.meta?.score}</strong>
                              </span>
                              <IonIcon
                                icon={chevronDownOutline}
                                className="score-pill-icon"
                              />
                            </button>
                            <IonButton
                              fill="clear"
                              size="small"
                              onClick={() => handleFavorite(message)}
                              title={t("conversationFavoriteButton")}
                            >
                              <IonIcon icon={bookmarkOutline} />
                            </IonButton>
                          </div>
                          {isScoreExpanded && message.meta?.scoreReason && (
                            <div className="score-details">
                              <p>{message.meta.scoreReason}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
              {pendingVoicePreview && (
                <article className="message-row message-user message-pending">
                  <img
                    src="/favicon.png"
                    alt="You avatar"
                    className="message-avatar"
                  />
                  <div className="message-bubble pending-bubble">
                    <div className="message-header">
                      <strong>{uiLanguage === "zh" ? "我" : "You"}</strong>
                      <IonText color="medium">
                        {new Date(
                          pendingVoicePreview.createdAt
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </IonText>
                    </div>
                    <div className="message-body">
                      <p className="message-translation">
                        {t("conversationVoiceUploadPending")}
                      </p>
                      <MessageAudioPlayer src={pendingVoicePreview.url} />
                      {voiceUploadStatus === "uploading" && (
                        <div className="message-loading-indicator">
                          <IonSpinner name="crescent" />
                          <IonText>{t(VOICE_TEXT_KEYS.uploadPending)}</IonText>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )}
              {showPendingTutorBubble && (
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
      <IonToast
        isOpen={Boolean(authToast)}
        message={authToast?.message ?? ""}
        duration={800}
        onDidDismiss={() => setAuthToast(null)}
        className={`conversation-toast ${authToast?.status ?? "success"}`}
        position="top"
      />
      {sidebarOpen && (
        <button
          type="button"
          className="conversation-sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={closeSidebar}
        />
      )}
      <aside
        className={`conversation-sidebar ${sidebarOpen ? "open" : ""}`}
        aria-hidden={!sidebarOpen}
      >
        <div className="sidebar-header">
          <div className="sidebar-profile">
            <IonIcon icon={personCircleOutline} />
            <div>
              <strong>
                {authProfile?.name ??
                  authProfile?.email ??
                  t("navConversation")}
              </strong>
              <span>
                {authProfile?.email ?? t("authHistoryButton")}
              </span>
            </div>
          </div>
          <IonButton fill="clear" onClick={closeSidebar}>
            <IonIcon icon={closeOutline} />
          </IonButton>
        </div>
        <div className="sidebar-section">
          {authStatus === "authenticated" ? (
            <>
              <p className="sidebar-section-note">
                {authProfile?.email ?? ""}
              </p>
              <IonButton expand="block" onClick={handleLogout}>
                <IonIcon icon={logOutOutline} slot="start" />
                {t("authLogoutButton")}
              </IonButton>
            </>
          ) : (
            <>
              <p className="sidebar-section-note">
                {t("authLoginRequired")}
              </p>
              <IonButton
                expand="block"
                onClick={handleGoogleLogin}
                disabled={isAuthBusy}
              >
                <IonIcon icon={logInOutline} slot="start" />
                {t("authLoginButton")}
              </IonButton>
            </>
          )}
        </div>
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <IonIcon icon={timeOutline} />
            <strong>{t("authHistoryTitle")}</strong>
          </div>
          {authStatus !== "authenticated" ? (
            <p className="history-empty">{t("authLoginRequired")}</p>
          ) : historyLoading ? (
            <div className="history-loading">
              <IonSpinner name="crescent" />
            </div>
          ) : historyItems.length ? (
            <IonList className="history-list">
              {historyItems.map((item) => (
                <IonItem
                  button
                  key={item.id}
                  onClick={() => handleSelectHistoryItem(item.id)}
                >
                  <IonLabel>
                    <h3>{describeScenarioLabel(item.scenarioId)}</h3>
                    <p>{item.lastMessage || t("authHistoryNoMessage")}</p>
                  </IonLabel>
                  <IonNote slot="end">
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </IonNote>
                </IonItem>
              ))}
            </IonList>
          ) : (
            <p className="history-empty">
              {historyError ?? t("authHistoryEmpty")}
            </p>
          )}
          {historyError && historyItems.length > 0 && (
            <p className="history-error">{historyError}</p>
          )}
        </div>
        {historyDetailLoading && authStatus === "authenticated" && (
          <div className="history-loading">
            <IonSpinner name="crescent" />
          </div>
        )}
        {selectedHistory && !historyDetailLoading && (
          <section className="history-messages">
            <div className="history-messages-header">
              <IonIcon icon={personCircleOutline} />
              <div>
                <h3>{describeScenarioLabel(selectedHistory.scenarioId)}</h3>
                <p>{new Date(selectedHistory.updatedAt).toLocaleString()}</p>
              </div>
            </div>
            <div className="history-messages-list">
              {selectedHistory.messages.map((message) => (
                <article
                  key={message.id}
                  className={`history-message history-${message.sender}`}
                >
                  <div className="history-message-header">
                    <strong>{message.senderName ?? message.sender}</strong>
                    <IonText color="medium">
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </IonText>
                  </div>
                  <p>{message.text}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </aside>
      <div className="conversation-composer glass-panel">
        <div className="composer-inner">
          <button
            type="button"
            className={`composer-icon-button composer-mic-button ${
              isRecording ? "is-holding" : ""
            }`}
            onClick={handleToggleRecording}
            disabled={voiceUploadStatus === "uploading" || showVoiceDraft}
            aria-pressed={isRecording}
            aria-label={t("conversationMicSeedText")}
          >
            <IonIcon icon={micOutline} />
          </button>
          <div
            className={`conversation-input-row ${composerRecordingClass} ${
              showVoiceDraft ? "has-voice-draft" : ""
            }`}
          >
            {voiceMemo ? (
              <div className="voice-memo-inline">
                <div className="voice-memo-inline-body">
                  <p>
                    {t(VOICE_TEXT_KEYS.previewHeading, {
                      seconds: Math.max(
                        VOICE_UI_CONSTANTS.previewMinSeconds,
                        Math.round(voiceMemo.durationMs / 1000),
                      ),
                    })}
                  </p>
                  <MessageAudioPlayer src={voiceMemo.url} />
                  {voiceUploadStatus === "uploading" && (
                    <p className="voice-memo-transcript">
                      {t(VOICE_TEXT_KEYS.uploadPending)}
                    </p>
                  )}
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
          <button
            type="button"
            className="composer-icon-button composer-send-button"
            onClick={handleSend}
            disabled={
              !session ||
              (!input.trim() && !voiceMemo) ||
              isAwaitingReply ||
              voiceUploadStatus === "uploading"
            }
            aria-label="Send message"
          >
            <IonIcon icon={arrowUpOutline} />
          </button>
        </div>
      </div>
    </IonPage>
  );
};

export default ConversationPage;
