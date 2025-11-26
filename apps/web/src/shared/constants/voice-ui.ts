export const VOICE_UI_CONSTANTS = {
  previewMinSeconds: 1,
};

import type { LocaleKey } from "../i18n/LocaleProvider";

export const VOICE_TEXT_KEYS = {
  previewHeading: "conversationVoicePreviewHeading" as LocaleKey,
  uploadPending: "conversationVoiceUploadPending" as LocaleKey,
} as const;

export const VOICE_STATUS_TEXT_KEYS = {
  received: "conversationVoiceStatusReceived" as LocaleKey,
  transcribing: "conversationVoiceStatusTranscribing" as LocaleKey,
  responding: "conversationVoiceStatusResponding" as LocaleKey,
  completed: "conversationVoiceStatusCompleted" as LocaleKey,
  failed: "conversationVoiceStatusFailed" as LocaleKey,
} as const;

export type VoiceProcessingStatusKey =
  keyof typeof VOICE_STATUS_TEXT_KEYS;

export type VoiceTextKey = (typeof VOICE_TEXT_KEYS)[keyof typeof VOICE_TEXT_KEYS];
