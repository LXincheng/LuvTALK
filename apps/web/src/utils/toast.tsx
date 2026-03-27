import type { ReactNode } from 'react';
import { toast as sonnerToast, type ExternalToast } from 'sonner';

type ToastVariant = 'info' | 'success' | 'warning' | 'error' | 'loading';

interface AppToastOptions extends ExternalToast {
  dedupeKey?: string;
  throttleMs?: number;
}

const DEFAULT_THROTTLE_MS = 1800;
const shownToastTimestamps = new Map<string, number>();

const normalizeNodeToText = (
  value: ReactNode | (() => ReactNode) | undefined,
) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return '';
};

const buildThrottleKey = (
  variant: ToastVariant,
  message: ReactNode,
  options: AppToastOptions,
) => {
  if (options.dedupeKey) {
    return `${variant}:${options.dedupeKey}`;
  }
  if (options.id !== undefined) {
    return `${variant}:id:${String(options.id)}`;
  }
  const descriptionText = normalizeNodeToText(options.description);
  return `${variant}:${normalizeNodeToText(message)}:${descriptionText}`;
};

const shouldThrottle = (key: string, throttleMs: number) => {
  if (throttleMs <= 0) {
    return false;
  }
  const now = Date.now();
  const lastShownAt = shownToastTimestamps.get(key);
  if (lastShownAt !== undefined && now - lastShownAt < throttleMs) {
    return true;
  }
  shownToastTimestamps.set(key, now);
  if (shownToastTimestamps.size > 200) {
    const cutoff = now - Math.max(throttleMs * 4, 12_000);
    for (const [entryKey, entryTimestamp] of shownToastTimestamps.entries()) {
      if (entryTimestamp < cutoff) {
        shownToastTimestamps.delete(entryKey);
      }
    }
  }
  return false;
};

const mergeClassName = (variant: ToastVariant, className?: string) =>
  ['app-toast', `app-toast--${variant}`, className].filter(Boolean).join(' ');

const emitToast = (
  variant: ToastVariant,
  message: ReactNode,
  options: AppToastOptions = {},
) => {
  const { dedupeKey, throttleMs = DEFAULT_THROTTLE_MS, className, ...rest } = options;
  const throttleKey = buildThrottleKey(variant, message, { ...rest, dedupeKey });
  if (shouldThrottle(throttleKey, throttleMs)) {
    return rest.id ?? dedupeKey ?? throttleKey;
  }

  const nextOptions: ExternalToast = {
    ...rest,
    id: rest.id ?? dedupeKey ?? throttleKey,
    className: mergeClassName(variant, className),
  };

  if (variant === 'info') {
    return sonnerToast.info(message, nextOptions);
  }
  if (variant === 'success') {
    return sonnerToast.success(message, nextOptions);
  }
  if (variant === 'warning') {
    return sonnerToast.warning(message, nextOptions);
  }
  if (variant === 'error') {
    return sonnerToast.error(message, nextOptions);
  }
  return sonnerToast.loading(message, nextOptions);
};

export const toast = {
  info: (message: ReactNode, options?: AppToastOptions) =>
    emitToast('info', message, options),
  success: (message: ReactNode, options?: AppToastOptions) =>
    emitToast('success', message, options),
  warning: (message: ReactNode, options?: AppToastOptions) =>
    emitToast('warning', message, options),
  error: (message: ReactNode, options?: AppToastOptions) =>
    emitToast('error', message, options),
  loading: (message: ReactNode, options?: AppToastOptions) =>
    emitToast('loading', message, options),
  message: (message: ReactNode, options?: AppToastOptions) =>
    emitToast('info', message, options),
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
};

export type { AppToastOptions };
