import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aiProviderSchema } from '@bemmoly/shared';
import { useSetupStore } from '../store/setup.ts';
import { renderQueryHook, signedInClient } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { BUNDLED_CATALOG } from './use-ai-catalog.ts';
import { aiSettingValues, aiSummary, choiceOf } from './use-ai-settings.ts';
import { useSetupAi } from './use-setup-ai.ts';

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
  it('leaves AI off with no AI chosen, and says so in the summary', async () => {
    mockApi.reset('wizard');
    const onSaved = vi.fn();
    const { result } = await renderQueryHook(() => useSetupAi(onSaved));
    expect(result.current.none).toBe(true);
    expect(result.current.canSave).toBe(true);
    act(() => result.current.submit());
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(mockApi.db.settings['ai.providerId']).toBeNull();
    expect(mockApi.db.ai.settings.privacy.enabled).toBe(false);
    expect(useSetupStore.getState().aiSaved).toBe(true);
  });

  it('saves a connected provider and turns AI on with the privacy choices', async () => {
    mockApi.reset('wizard');
    const onSaved = vi.fn();
    const { result } = await renderQueryHook(() => useSetupAi(onSaved));
    act(() => result.current.pick(PROVIDER));
    expect(result.current.canSave).toBe(false);
    const row = aiProviderSchema.parse(
      mockApi.dispatch('POST', '/api/v1/admin/ai/providers', {
        kind: 'catalog',
        catalogId: PROVIDER,
        credentials: { KEY: 'value' },
      })?.body,
    );
    await act(() => result.current.onConnected(row));
    act(() => result.current.setShareContent(false));
    await waitFor(() => expect(result.current.provider?.id).toBe(row.id));
    act(() => result.current.submit());
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(mockApi.db.settings['ai.providerId']).toBe(PROVIDER);
    expect(mockApi.db.ai.settings.privacy).toMatchObject({ enabled: true, shareContent: false });
    expect(mockApi.db.ai.roles.standard?.providerId).toBe(row.id);
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
