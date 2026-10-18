import { queryKeys } from '@bemmoly/api-client';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { isShownBoard } from './use-shell-effects.ts';

/* The shell's socket leaves a board on screen to the Work screen's own socket. */

const BOARD = [...queryKeys.work(), 'board-view', 'b', {}];

describe('isShownBoard', () => {
  it('is a board view only while a screen shows it', () => {
    const client = new QueryClient();
    client.setQueryData(BOARD, {});
    client.setQueryData([...queryKeys.work(), 'projects'], []);
    const cache = client.getQueryCache();
    const board = cache.find({ queryKey: BOARD, exact: true })!;
    expect(isShownBoard(board)).toBe(false);
    const stop = new QueryObserver(client, { queryKey: BOARD, enabled: false }).subscribe(
      () => undefined,
    );
    expect(isShownBoard(board)).toBe(true);
    expect(isShownBoard(cache.find({ queryKey: [...queryKeys.work(), 'projects'] })!)).toBe(false);
    stop();
  });
});
