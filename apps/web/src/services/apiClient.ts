import { getAccessToken } from './authService';

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

interface ApiRequestOptions extends RequestInit {
  skipJson?: boolean;
  timeoutMs?: number;
}

interface CachedGetOptions<T> {
  shouldReplaceCache?: (current: T | null, next: T) => boolean;
  keepStaleOnError?: boolean;
}

async function readResponseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const isFormDataBody = options.body instanceof FormData;
  const accessToken = await getAccessToken();
  const { headers: customHeaders, timeoutMs, signal, ...restOptions } = options;
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId =
    controller && timeoutMs
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : null;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...restOptions,
    signal: controller?.signal ?? signal,
    headers: {
      ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(customHeaders ?? {}),
    },
  }).catch((error: unknown) => {
    if (
      controller?.signal.aborted &&
      error instanceof DOMException &&
      error.name === 'AbortError'
    ) {
      throw new Error('请求超时，请稍后再试');
    }
    throw error;
  }).finally(() => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  });

  if (!response.ok) {
    const message = await readResponseText(response);
    throw new Error(message || `请求失败（${response.status}）`);
  }

  if (options.skipJson) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

export const apiClient = {
  get: <T>(path: string, options?: ApiRequestOptions) => apiRequest<T>(path, options),
  post: <T, TBody = unknown>(
    path: string,
    body: TBody,
    options?: ApiRequestOptions,
  ) =>
    apiRequest<T>(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    }),
  postWithOptions: <T, TBody = unknown>(
    path: string,
    body: TBody,
    options?: ApiRequestOptions,
  ) =>
    apiRequest<T>(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    }),
  postForm: <T>(path: string, formData: FormData, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body: formData }),
  delete: <T>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};

// Simple stale-while-revalidate cache for GET requests
const swrCache = new Map<string, { data: unknown; timestamp: number }>();
const swrInflight = new Map<string, Promise<unknown>>();
const SWR_TTL = 60_000; // 1 minute stale window

export function cachedGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: CachedGetOptions<T>,
): {
  cached: T | null;
  fresh: Promise<T>;
} {
  const entry = swrCache.get(key);
  const now = Date.now();
  const cached =
    entry && now - entry.timestamp < SWR_TTL ? (entry.data as T) : null;
  const existingInflight = swrInflight.get(key) as Promise<T> | undefined;
  const fresh = existingInflight ?? fetcher()
    .then((data) => {
      const latestEntry = swrCache.get(key);
      const currentCached =
        latestEntry && Date.now() - latestEntry.timestamp < SWR_TTL
          ? (latestEntry.data as T)
          : cached;
      const shouldReplace = options?.shouldReplaceCache
        ? options.shouldReplaceCache(currentCached, data)
        : true;
      if (!shouldReplace && currentCached) {
        return currentCached;
      }
      swrCache.set(key, { data, timestamp: Date.now() });
      return data;
    })
    .catch((error) => {
      if ((options?.keepStaleOnError ?? true) && cached) {
        return cached;
      }
      throw error;
    })
    .finally(() => {
      swrInflight.delete(key);
    });
  if (!existingInflight) {
    swrInflight.set(key, fresh);
  }
  return { cached, fresh };
}

export function invalidateCache(key: string) {
  swrCache.delete(key);
  swrInflight.delete(key);
}

export function clearAllCaches() {
  swrCache.clear();
  swrInflight.clear();
}
