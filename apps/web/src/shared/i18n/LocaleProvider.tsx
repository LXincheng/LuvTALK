import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type UiLanguage = "zh" | "en";

const STORAGE_KEY = "luvtalk-ui-language";
const FALLBACK_LOCALE: UiLanguage = "zh";

const translations = {
  zh: {
    localeNameZh: "中文界面",
    localeNameEn: "English",
    actionSwitchUiLanguage: "切换界面语言",
    navConversation: "AI 导师",
    navFavorites: "收藏夹",
    conversationScenarioHeading: "练习场景",
    conversationScenarioAria: "选择练习场景",
    conversationLanguageHeading: "学习语言",
    conversationLanguageAria: "选择需要练习的语言",
    conversationUiLanguageLabel: "界面语言",
    conversationLoading: "AI 导师正在准备会话...",
    conversationCoachScore: "评分",
    conversationFavoriteButton: "收藏此条回复",
    conversationInputPlaceholder: "输入文字或点击开始录音",
    conversationMicSeedText: "我想练习点餐对话",
    conversationScenarioCurrentLabel: "当前场景",
    conversationReplyPending: "导师思考中...",
    favoritesTitle: "收藏夹",
    favoritesHeroLabel: "学习素材",
    favoritesHeroDescription: "收藏的文化提示与语句都会保存在这里。",
    favoritesLoading: "正在同步收藏...",
    favoritesEmptyTitle: "点击回复旁的书签即可收藏",
    favoritesEmptyDescription: "文化提示、语音片段会自动显示在这里。",
    favoritesRemoveButton: "移除该收藏",
    favoritesAddSuccess: "已加入收藏",
    favoritesAddError: "收藏失败，请稍后再试",
    favoritesRemoveSuccess: "收藏已删除",
    favoritesRemoveError: "暂时无法删除，请重试",
    favoriteTypePhrase: "表达句型",
    favoriteTypeCultural: "文化提示",
    favoriteTypeVocabulary: "词汇",
    favoriteTypeScenario: "场景灵感",
    labelLanguage: "语言",
    labelScenario: "场景",
    conversationVoicePreviewHeading: "{seconds} 秒语音草稿已就绪",
    conversationVoicePreviewNote:
      "点击发送后系统会自动转写，并由 AI 导师回复。",
    conversationVoiceUploadPending: "正在上传语音... 导师很快会回复你。",
    conversationVoiceDiscard: "删除语音草稿",
    conversationVoiceNotSupported: "当前浏览器不支持语音录制。",
    conversationVoiceUploadSuccess: "语音已发送，导师正在处理转写。",
    conversationVoiceSendError: "语音上传失败，请再试一次。",
    conversationVoicePermissionDenied:
      "麦克风权限被拒绝，请在浏览器设置中允许访问。",
    conversationVoiceGenericError: "录音出现问题，请重新尝试。",
    conversationVoiceRecordingStarted: "开始录音... 再次点击结束。",
    conversationVoiceRecordingStopped: "语音已保存，点击发送即可上传。",
    conversationVoiceTtsButton: "播放发音",
    conversationVoiceTtsFetching: "生成语音中...",
    conversationVoiceTtsError: "暂时无法播放发音，请稍后重试。",
  },
  en: {
    localeNameZh: "Chinese",
    localeNameEn: "English",
    actionSwitchUiLanguage: "Switch interface language",
    navConversation: "AI Tutor",
    navFavorites: "Favorites",
    conversationScenarioHeading: "Practice scenario",
    conversationScenarioAria: "Pick a practice scenario",
    conversationLanguageHeading: "Learning language",
    conversationLanguageAria: "Choose the language you want to learn",
    conversationUiLanguageLabel: "Interface language",
    conversationLoading: "Preparing your tutor session...",
    conversationCoachScore: "Score",
    conversationFavoriteButton: "Save to favorites",
    conversationInputPlaceholder: "Type or hold the mic",
    conversationMicSeedText: "I want to practice ordering food",
    conversationScenarioCurrentLabel: "Current scenario",
    conversationReplyPending: "Thinking…",
    favoritesTitle: "Favorites",
    favoritesHeroLabel: "Learning assets",
    favoritesHeroDescription:
      "Saved culture tips, phrases, and clips live here.",
    favoritesLoading: "Syncing your favorites...",
    favoritesEmptyTitle: "Tap the bookmark near any AI reply to save it",
    favoritesEmptyDescription:
      "Culture notes and voice clips will appear here automatically.",
    favoritesRemoveButton: "Remove this favorite",
    favoritesAddSuccess: "Added to favorites",
    favoritesAddError: "Couldn't save favorite, try again",
    favoritesRemoveSuccess: "Removed from favorites",
    favoritesRemoveError: "Couldn't remove favorite, try again",
    favoriteTypePhrase: "Speech pattern",
    favoriteTypeCultural: "Culture tip",
    favoriteTypeVocabulary: "Vocabulary",
    favoriteTypeScenario: "Scenario idea",
    labelLanguage: "Language",
    labelScenario: "Scenario",
    conversationVoicePreviewHeading: "{seconds}s voice clip ready",
    conversationVoicePreviewNote:
      "Hit send and we'll auto-transcribe it for your tutor.",
    conversationVoiceUploadPending:
      "Uploading clip... your tutor will reply shortly.",
    conversationVoiceDiscard: "Remove voice draft",
    conversationVoiceNotSupported:
      "Voice recording isn't supported in this browser.",
    conversationVoiceUploadSuccess:
      "Voice message sent. Your tutor will reply as soon as it's transcribed.",
    conversationVoiceSendError:
      "We couldn't upload that voice clip. Please try again.",
    conversationVoicePermissionDenied:
      "Microphone permission was denied. Allow access in your browser settings and try again.",
    conversationVoiceGenericError:
      "Recorder hit an issue. Please retry your voice note.",
    conversationVoiceRecordingStarted:
      "Recording... release the mic button to finish.",
    conversationVoiceRecordingStopped:
      "Voice clip saved. Hit send to upload it to your tutor.",
    conversationVoiceTtsButton: "Listen",
    conversationVoiceTtsFetching: "Generating audio...",
    conversationVoiceTtsError:
      "Tutor speech synthesis is unavailable right now.",
  },
} as const;

type TranslationMap = typeof translations;
export type LocaleKey = keyof TranslationMap["zh"];

interface LocaleContextValue {
  uiLanguage: UiLanguage;
  setUiLanguage: (language: UiLanguage) => void;
  t: (key: LocaleKey, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

const formatMessage = (
  template: string,
  params?: Record<string, string | number>
) =>
  template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = params?.[token];
    return value === undefined ? "" : String(value);
  });

const resolveInitialLocale = (): UiLanguage => {
  if (typeof window === "undefined") {
    return FALLBACK_LOCALE;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY) as UiLanguage | null;
  if (stored === "zh" || stored === "en") {
    return stored;
  }

  const prefersZh = window.navigator.language?.toLowerCase().startsWith("zh");
  return prefersZh ? "zh" : "en";
};

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const [uiLanguage, setUiLanguageState] =
    useState<UiLanguage>(resolveInitialLocale);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, uiLanguage);
      document.documentElement.lang = uiLanguage === "zh" ? "zh-Hans" : "en";
    }
  }, [uiLanguage]);

  const setUiLanguage = useCallback((language: UiLanguage) => {
    setUiLanguageState(language);
  }, []);

  const t = useCallback(
    (key: LocaleKey, params?: Record<string, string | number>) => {
      const template =
        translations[uiLanguage][key] ?? translations[FALLBACK_LOCALE][key];
      return formatMessage(template, params);
    },
    [uiLanguage]
  );

  const value = useMemo(
    () => ({
      uiLanguage,
      setUiLanguage,
      t,
    }),
    [uiLanguage, setUiLanguage, t]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
};

export const useLocale = (): LocaleContextValue => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
};
