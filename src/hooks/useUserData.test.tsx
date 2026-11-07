import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserData, type UserDataSnapshot } from './useUserData';
import { clearUserDataCache, readUserDataCache, writeUserDataCache } from '@/lib/userDataCache';

const snapshot = (name: string): UserDataSnapshot => ({
  profile: { id: 'account-a', auth_user_id: 'account-a', email: 'test@example.test', first_name: name,
    last_name: null, birth_date: null, birth_time: null, subscription_until: null },
  tasks: [], habits: [], habitCompletions: [], dailyEnergy: [], baziChart: null,
  monthlyEvents: [], userHint: null, individualForecasts: [], generalForecast: null,
  achievements: [], userGoals: [], stemToStemRules: [], stemToBranchRules: [],
  dayBranchRules: [], yearBranchRules: [], monthBranchRules: [],
});

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  localStorage.setItem('auth_token', 'test-token');
  localStorage.setItem('auth_user', JSON.stringify({ id: 'account-a' }));
});

describe('planner startup', () => {
  it('shows saved data immediately and makes one background request for concurrent consumers', async () => {
    writeUserDataCache('account-a', snapshot('Saved'));
    let resolve: (response: Response) => void = () => {};
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(r => { resolve = r; }));
    const first = renderHook(useUserData);
    const second = renderHook(useUserData);
    expect(first.result.current.loading).toBe(false);
    expect(first.result.current.profile?.first_name).toBe('Saved');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('action=bootstrap');
    await act(async () => { resolve(new Response(JSON.stringify({ data: snapshot('Fresh') }))); });
    await waitFor(() => expect(first.result.current.profile?.first_name).toBe('Fresh'));
    expect(second.result.current.profile?.first_name).toBe('Fresh');
    expect(readUserDataCache<UserDataSnapshot>('account-a')?.profile?.first_name).toBe('Fresh');
  });

  it('keeps saved content when background refresh fails', async () => {
    writeUserDataCache('account-a', snapshot('Saved'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline'));
    const hook = renderHook(useUserData);
    await waitFor(() => expect(hook.result.current.error).toBe('Offline'));
    expect(hook.result.current.profile?.first_name).toBe('Saved');
    expect(hook.result.current.loading).toBe(false);
  });

  it('never displays another account snapshot', async () => {
    writeUserDataCache('account-b', snapshot('Other'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline'));
    const hook = renderHook(useUserData);
    expect(hook.result.current.profile).toBeNull();
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
  });

  it('persists successful task changes for the next launch', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => new Response(JSON.stringify(
      String(url).includes('bootstrap') ? { data: snapshot('Fresh') } : { data: [{
        id: 'task-1', user_id: 'account-a', text: 'Walk', date: '2026-10-27', completed: false, created_at: '2026-10-27',
      }] }
    )));
    const hook = renderHook(useUserData);
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => { await hook.result.current.addTask('Walk', '2026-10-27'); });
    expect(readUserDataCache<UserDataSnapshot>('account-a')?.tasks[0]?.text).toBe('Walk');
  });

  it('does not restore a late response after logout', async () => {
    let resolve: (response: Response) => void = () => {};
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(r => { resolve = r; }));
    const hook = renderHook(useUserData);
    localStorage.removeItem('auth_token');
    clearUserDataCache();
    await act(async () => { resolve(new Response(JSON.stringify({ data: snapshot('Late') }))); });
    expect(hook.result.current.profile).toBeNull();
    expect(readUserDataCache('account-a')).toBeNull();
  });
});