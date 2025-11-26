export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

interface ApiRequestOptions extends RequestInit {
  skipJson?: boolean;
}

let authToken: string | undefined = undefined;

export const setApiAuthToken = (token?: string) => {
  authToken = token || undefined;
};

export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const isFormDataBody = options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `API request failed (${response.status})`);
  }

  if (options.skipJson) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

export const apiClient = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T, TBody = unknown>(path: string, body: TBody) =>
    apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  postForm: <T>(path: string, formData: FormData) =>
    apiRequest<T>(path, { method: 'POST', body: formData }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
