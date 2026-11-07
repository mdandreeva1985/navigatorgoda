import { beforeEach, expect, it, vi } from 'vitest';
import { resetAuthVerification, verifySession } from './authVerification';

beforeEach(() => { vi.restoreAllMocks(); resetAuthVerification(); });

it('combines seven identical verification requests into one and reuses the refreshed session', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ token: 'fresh-token', user: { id: 'a' } })));
  const responses = await Promise.all(Array.from({ length: 7 }, () => verifySession('old-token')));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  for (const response of responses) expect((await response.json()).user.id).toBe('a');
  await verifySession('fresh-token');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('allows a retry after network failure', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValue(new Response(JSON.stringify({ user: { id: 'a' } })));
  await expect(verifySession('token')).rejects.toThrow('Offline');
  expect((await verifySession('token')).ok).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});