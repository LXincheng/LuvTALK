import { getAccessToken } from './authService';

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

interface ApiRequestOptions extends RequestInit {
  skipJson?: boolean;
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
  const { headers: customHeaders, ...restOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...restOptions,
    headers: {
      ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(customHeaders ?? {}),
    },
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
  post: <T, TBody = unknown>(path: string, body: TBody) =>
    apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) }),
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
const SWR_TTL = 60_000; // 1 minute stale window

export function cachedGet<T>(key: string, fetcher: () => Promise<T>): {
  cached: T | null;
  fresh: Promise<T>;
} {
  const entry = swrCache.get(key);
  const now = Date.now();
  const cached =
    entry && now - entry.timestamp < SWR_TTL ? (entry.data as T) : null;
  const fresh = fetcher().then((data) => {
    swrCache.set(key, { data, timestamp: Date.now() });
    return data;
  });
  return { cached, fresh };
}

export function invalidateCache(key: string) {
  swrCache.delete(key);
}
