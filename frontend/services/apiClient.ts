import { getApiBase } from '@/constants';

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
  }
}

/**
 * Fetches a URL with exponential backoff retry logic.
 */
export async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 1000): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (!response.ok && response.status >= 500 && retries > 0) {
      throw new Error(`Server error ${response.status}`);
    }
    return response;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    if (options?.signal?.aborted) {
      throw err;
    }
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw err;
  }
}

async function request<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const base = getApiBase();
  const fullUrl = url.startsWith('http') ? url : `${base}${url}`;

  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type') && !(options?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    const apiKey = window.localStorage.getItem('prism_api_key');
    if (apiKey && !headers.has('X-API-Key')) {
      headers.set('X-API-Key', apiKey);
    }
    const authToken = window.localStorage.getItem('prism_auth_token');
    if (authToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }
  }

  const response = await fetchWithRetry(fullUrl, {
    ...options,
    headers,
  });

  if (!response.ok) {
    /**
     * data - Performs data.
     */
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, `API error: ${response.statusText}`, data);
  }

  // Handle empty responses (e.g. 204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * apiClient - Performs api client.
 */
export const apiClient = {
  get: <T = unknown>(url: string, options?: RequestInit) => request<T>(url, options),
  post: <T = unknown>(url: string, body: unknown, options?: RequestInit) =>
    request<T>(url, { ...options, method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
  put: <T = unknown>(url: string, body: unknown, options?: RequestInit) =>
    request<T>(url, { ...options, method: 'PUT', body: body instanceof FormData ? body : JSON.stringify(body) }),
  patch: <T = unknown>(url: string, body: unknown, options?: RequestInit) =>
    request<T>(url, { ...options, method: 'PATCH', body: body instanceof FormData ? body : JSON.stringify(body) }),
  delete: <T = unknown>(url: string, options?: RequestInit) => request<T>(url, { ...options, method: 'DELETE' }),
};
