import { getCachedAccountId } from './userDataCache';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/external-db`;
const ATTEMPT_TIMEOUT_MS = 15000;

let prefetch: { accountId: string; request: Promise<unknown> } | null = null;

async function requestOnce<T>(token: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    // text/plain POST without an Authorization header is a "simple" request:
    // the browser sends it straight away instead of first asking permission.
    const response = await fetch(`${FUNCTION_URL}?action=bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ token }),
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to load data');
    return result.data as T;
  } finally {
    clearTimeout(timeout);
  }
}

/** Loads the planner snapshot; a stalled mobile connection gets one fresh retry. */
export async function fetchBootstrap<T>(): Promise<T> {
  const token = localStorage.getItem('auth_token');
  if (!token) throw new Error('Not authenticated');
  try {
    return await requestOnce<T>(token);
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') throw err;
    return requestOnce<T>(localStorage.getItem('auth_token') || token);
  }
}

/** Starts the startup download before React renders. */
export function startBootstrapPrefetch(): void {
  const accountId = getCachedAccountId();
  if (!accountId || prefetch) return;
  const request = fetchBootstrap();
  request.catch(() => { /* the screen retries and reports errors itself */ });
  prefetch = { accountId, request };
}

/** Hands the early download to the first consumer for the same account (once). */
export function takeBootstrapPrefetch<T>(accountId: string): Promise<T> | null {
  const current = prefetch;
  prefetch = null;
  return current?.accountId === accountId ? (current.request as Promise<T>) : null;
}

export function clearBootstrapPrefetch(): void {
  prefetch = null;
}
