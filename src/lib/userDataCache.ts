const PREFIX = 'planner-data-v1:';
const pending = new Map<string, Promise<unknown>>();

export function getCachedAccountId(): string | null {
  try {
    if (!localStorage.getItem('auth_token')) return null;
    const user = JSON.parse(localStorage.getItem('auth_user') || 'null');
    return typeof user?.id === 'string' ? user.id : null;
  } catch {
    return null;
  }
}

export function readUserDataCache<T>(accountId: string | null): T | null {
  if (!accountId) return null;
  try {
    const cached = JSON.parse(localStorage.getItem(PREFIX + accountId) || 'null');
    return cached?.accountId === accountId && cached?.version === 1 ? cached.data as T : null;
  } catch {
    return null;
  }
}

export function writeUserDataCache<T>(accountId: string, data: T): void {
  try {
    localStorage.setItem(PREFIX + accountId, JSON.stringify({ version: 1, accountId, data }));
  } catch { /* Storage unavailable or full: keep the live data. */ }
}

export function clearUserDataCache(): void {
  try {
    Object.keys(localStorage).filter(key => key.startsWith(PREFIX)).forEach(key => localStorage.removeItem(key));
  } catch { /* Storage unavailable. */ }
}

export function deduplicateUserData<T>(accountId: string, load: () => Promise<T>): Promise<T> {
  const existing = pending.get(accountId);
  if (existing) return existing as Promise<T>;
  const request = load().finally(() => {
    if (pending.get(accountId) === request) pending.delete(accountId);
  });
  pending.set(accountId, request);
  return request;
}