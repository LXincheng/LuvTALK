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
    localeNameZh: "简体中文",
    localeNameEn: "English",
    actionSwitchUiLanguage: "切换界面语言",
    navConversation: "AI 对话",
    navFavorites: "收藏夹",
    conversationScenarioHeading: "练习场景",
    conversationScenarioAria: "选择练习场景",
    conversationLanguageHeading: "学习语言",
    conversationLanguageAria: "选择想要练习的语言",
    conversationUiLanguageLabel: "界面语言",
    conversationLoading: "AI 正在准备场景...",
    conversationCoachScore: "评分",
    conversationFavoriteButton: "收藏此内容",
    conversationInputPlaceholder: "输入或按住语音按钮",
    conversationMicSeedText: "我想练习点餐对话",
    conversationScenarioCurrentLabel: "当前场景",
    conversationReplyPending: "正在生成...",
    favoritesTitle: "收藏夹",
    favoritesHeroLabel: "学习资产",
    favoritesHeroDescription: "收藏的文化提示、短语和语音片段都会保存在这里。",
    favoritesLoading: "正在同步收藏内容...",
    favoritesEmptyTitle: "点击 AI 回复旁的书签即可收藏",
    favoritesEmptyDescription: "文化提示和语音片段会自动同步到这里。",
    favoritesRemoveButton: "移除此收藏",
    favoritesAddSuccess: "收藏已保存",
    favoritesAddError: "收藏失败，请稍后重试",
    favoritesRemoveSuccess: "收藏已删除",
    favoritesRemoveError: "无法删除收藏，请重试",
    favoriteTypePhrase: "常用句型",
    favoriteTypeCultural: "文化提示",
    favoriteTypeVocabulary: "词汇",
    favoriteTypeScenario: "场景灵感",
    labelLanguage: "语言",
    labelScenario: "场景",
    conversationVoicePreviewHeading: "{seconds} 秒语音片段已就绪",
    conversationVoicePreviewNote:
      "点击发送，我们会自动转写语音给你的 AI 教练。",
    conversationVoiceUploadPending: "正在上传语音... AI 即将回复你。",
    conversationVoiceDiscard: "删除草稿语音",
    conversationVoiceNotSupported: "当前浏览器暂不支持语音录制。",
    conversationVoiceUploadSuccess:
      "语音消息已发送。AI 教练将在转写完成后回复你。",
    conversationVoiceSendError: "语音上传失败，请重试。",
    conversationVoicePermissionDenied:
      "麦克风权限已被拒绝，请在浏览器设置中允许访问后重试。",
    conversationVoiceGenericError: "录音出现问题，请重试。",
    conversationVoiceRecordingStarted: "正在录音... 松开按钮即可完成录制。",
    conversationVoiceRecordingStopped: "语音已保存，点击发送即可上传。",
    conversationVoiceTtsButton: "收听",
    conversationVoiceTtsFetching: "正在生成语音...",
    conversationVoiceTtsError: "当前无法生成语音，请稍后再试。",
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
