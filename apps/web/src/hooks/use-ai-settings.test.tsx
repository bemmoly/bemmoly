import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSetupStore } from '../store/setup.ts';
import { renderQueryHook, signedInClient } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { BUNDLED_CATALOG } from './use-ai-catalog.ts';
import {
  aiSettingValues,
  aiSummary,
  choiceOf,
  useAiSettings,
  useSetupAi,
} from './use-ai-settings.ts';

const PROVIDER = BUNDLED_CATALOG.popular[0] as string;

beforeEach(() => useSetupStore.getState().reset());

describe('AI choice values', () => {
  it('stores no AI as null and keeps local and catalog ids', () => {
    const privacy = { shareContent: false, allowActions: true };
    expect(aiSettingValues({ ai: 'none', ...privacy })['ai.providerId']).toBeNull();
    expect(aiSettingValues({ ai: 'local', ...privacy })['ai.providerId']).toBe('local');
    expect(aiSettingValues({ ai: PROVIDER, ...privacy })).toEqual({
      'ai.providerId': PROVIDER,
      'ai.shareContent': false,
      'ai.allowActions': true,
    });
    expect(choiceOf(null)).toBe('none');
  });

  it('summarises the choice in words', () => {
    expect(aiSummary(null, { shareContent: true, allowActions: true })).toBe('No AI for now');
    expect(aiSummary('Local server', { shareContent: false, allowActions: false })).toBe(
      'Local server · titles and metadata only · AI actions off',
    );
  });
});

describe('useSetupAi', () => {
  it('saves the provider and both privacy toggles, then moves on', async () => {
    const onSaved = vi.fn();
    const { result } = await renderQueryHook(() => useSetupAi(onSaved));
    act(() => result.current.pick(PROVIDER));
    act(() => result.current.setShareContent(false));
    expect(result.current.picker.connection?.fields.length).toBeGreaterThan(0);
    expect(result.current.picker.status).toBe('Offline · bundled with 0.1.0');
    act(() => result.current.submit());
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(mockApi.db.settings['ai.providerId']).toBe(PROVIDER);
    expect(mockApi.db.settings['ai.shareContent']).toBe(false);
    expect(mockApi.db.settings['ai.allowActions']).toBe(true);
    expect(useSetupStore.getState().aiSaved).toBe(true);
  });

  it('reports a refused write and stays on the step', async () => {
    mockApi.reset('member');
    const onSaved = vi.fn();
    const { result } = await renderQueryHook(() => useSetupAi(onSaved), await signedInClient());
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.save.isError).toBe(true));
    expect(onSaved).not.toHaveBeenCalled();
    expect(useSetupStore.getState().aiSaved).toBe(false);
  });
});

describe('useAiSettings', () => {
  it('loads the stored choice and saves a new one', async () => {
    const { result } = await renderQueryHook(() => useAiSettings());
    await waitFor(() => expect(result.current.draft.value).toBeDefined());
    expect(result.current.canConfigure).toBe(true);
    expect(result.current.choice).toBe('none');
    expect(result.current.modelRoles.map((role) => role.id)).toEqual([
      'fast',
      'standard',
      'strong',
      'embedding',
    ]);
    act(() => result.current.pick('local'));
    act(() => result.current.draft.update({ allowActions: false }));
    expect(result.current.draft.dirty).toBe(true);
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.settings.save.isSuccess).toBe(true));
    expect(mockApi.db.settings['ai.providerId']).toBe('local');
    expect(mockApi.db.settings['ai.allowActions']).toBe(false);
  });

  it('lets only people who can configure models save', async () => {
    mockApi.reset('member');
    const { result } = await renderQueryHook(() => useAiSettings(), await signedInClient());
    expect(result.current.canConfigure).toBe(false);
    expect(result.current.disabledReason).not.toBeNull();
    act(() => result.current.submit());
    expect(result.current.settings.save.isIdle).toBe(true);
  });
});
