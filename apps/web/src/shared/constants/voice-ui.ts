export const VOICE_UI_CONSTANTS = {
  previewMinSeconds: 1,
};

import type { LocaleKey } from "../i18n/LocaleProvider";

export const VOICE_TEXT_KEYS = {
  previewHeading: "conversationVoicePreviewHeading" as LocaleKey,
  uploadPending: "conversationVoiceUploadPending" as LocaleKey,
} as const;

export type VoiceTextKey = (typeof VOICE_TEXT_KEYS)[keyof typeof VOICE_TEXT_KEYS];
