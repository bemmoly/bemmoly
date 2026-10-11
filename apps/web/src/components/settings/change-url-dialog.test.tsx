import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UrlHint } from './change-url-dialog.tsx';

describe('UrlHint', () => {
  it('opens the guide with the command that changes the domain', () => {
    render(<UrlHint />);
    expect(screen.getByText(/Set by BEMMOLY_PUBLIC_URL on the server\./)).toBeDefined();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'How to change' })));
    expect(screen.getByText('sudo bemmoly domain set new.example.com')).toBeDefined();
    expect(screen.getByText(/unavailable for a few seconds/)).toBeDefined();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Done' })));
    expect(screen.queryByText('Change the URL')).toBeNull();
  });
});
