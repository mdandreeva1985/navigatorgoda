import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearBootstrapPrefetch, fetchBootstrap, startBootstrapPrefetch, takeBootstrapPrefetch } from './bootstrap';

beforeEach(() => {
  vi.restoreAllMocks();
  clearBootstrapPrefetch();
  localStorage.clear();
  localStorage.setItem('auth_token', 'test-token');
  localStorage.setItem('auth_user', JSON.stringify({ id: 'account-a' }));
});

const ok = () => new Response(JSON.stringify({ data: { profile: { id: 'account-a' } } }));

describe('startup download', () => {
  it('sends the token in the body without an Authorization header (no extra permission round trip)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok());
    await fetchBootstrap();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('action=bootstrap');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('text/plain;charset=UTF-8');
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(JSON.parse(String(init?.body)).token).toBe('test-token');
  });

  it('retries once after a network failure', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('Network'))
      .mockResolvedValueOnce(ok());
    await expect(fetchBootstrap()).resolves.toEqual({ profile: { id: 'account-a' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry when the session is rejected', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));
    await expect(fetchBootstrap()).rejects.toThrow('Unauthorized');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('hands the early download only to the same account, once', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok());
    startBootstrapPrefetch();
    expect(takeBootstrapPrefetch('account-b')).toBeNull();
    startBootstrapPrefetch();
    expect(takeBootstrapPrefetch('account-a')).not.toBeNull();
    expect(takeBootstrapPrefetch('account-a')).toBeNull();
  });
});
