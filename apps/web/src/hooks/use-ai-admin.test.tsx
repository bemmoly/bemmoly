import { keysForEvent, queryKeys } from '@bemmoly/api-client';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { seedAiOn } from '../mocks/seed/ai.ts';
import { renderQueryHook } from '../test/render.tsx';
import { applyUpdate, inverseOf, useAiAdminSettings } from './use-ai-admin.ts';
import { useWorkspace } from './use-workspace.ts';

const SETTINGS = seedAiOn().settings;

describe('AI settings changes', () => {
  it('merges a change the way the server does and knows how to undo it', () => {
    const body = { privacy: { redactNames: true }, liveCatalog: false };
    const next = applyUpdate(SETTINGS, body);
    expect(next.privacy).toMatchObject({ redactNames: true, shareContent: true });
    expect(next.liveCatalog).toBe(false);
    expect(inverseOf(SETTINGS, body)).toEqual({
      privacy: { redactNames: false },
      liveCatalog: true,
    });
    expect(inverseOf(SETTINGS, { budget: { monthlyBudgetUsd: 5 } })).toEqual({
      budget: { monthlyBudgetUsd: 150 },
    });
  });

  it('refreshes the session and the workspace look when an ai event arrives', () => {
    const keys = keysForEvent('ai.changed').map((key) => JSON.stringify(key));
    expect(keys).toContain(JSON.stringify(queryKeys.me()));
    expect(keys).toContain(JSON.stringify(queryKeys.settings.all()));
    expect(keys).toContain(JSON.stringify(queryKeys.ai.all()));
  });
});

describe('useWorkspace().aiEnabled', () => {
  it('follows an admin turning AI off and on, without a reload', async () => {
    const { result } = await renderQueryHook(() => ({
      workspace: useWorkspace(),
      admin: useAiAdminSettings(),
    }));
    await waitFor(() => expect(result.current.workspace.aiEnabled).toBe(true));
    await waitFor(() => expect(result.current.admin.settings).toBeDefined());
    act(() => result.current.admin.change({ privacy: { enabled: false } }, { title: 'Off' }));
    await waitFor(() => expect(result.current.workspace.aiEnabled).toBe(false));
    act(() => result.current.admin.change({ privacy: { enabled: true } }, { title: 'On' }));
    await waitFor(() => expect(result.current.workspace.aiEnabled).toBe(true));
  });
});
