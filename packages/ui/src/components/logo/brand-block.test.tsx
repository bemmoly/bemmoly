import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { MenuItem } from '../menu/menu-item.tsx';
import { BrandBlock, BrandRailFoot, BrandRailTop } from './brand-block.tsx';
import { BRAND_FILES, trimmed } from './brand-files.ts';

const ACME = { name: 'Acme Labs', src: 'data:image/png;base64,AAAA' };

describe('BrandBlock', () => {
  it('leads with Bemmoly and opens the workspace menu from the line under it', async () => {
    const onMenu = vi.fn();
    const { container } = render(<BrandBlock workspaceName="Acme Labs" onWorkspaceMenu={onMenu} />);
    expect(screen.getByRole('img', { name: 'Bemmoly' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Acme Labs, workspace menu' }));
    expect(onMenu).toHaveBeenCalledOnce();
    await expectAccessible(container);
  });

  it('opens its own workspace menu of items, with no switcher in it', () => {
    render(
      <BrandBlock
        workspaceName="Acme Labs"
        workspaceMenu={<MenuItem onSelect={() => undefined}>Workspace settings</MenuItem>}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Acme Labs, workspace menu' }));
    expect(screen.getByRole('menuitem', { name: 'Workspace settings' })).toBeTruthy();
  });

  it('moves Bemmoly to "on Bemmoly" under a customer logo, and never drops it', () => {
    const { container } = render(<BrandBlock workspaceName="Acme Labs" customLogo={ACME} />);
    expect(container.textContent).toContain('Acme Labs');
    expect(container.textContent?.replace(/\s+/g, ' ')).toContain('on Bemmoly');
    expect(container.querySelector('img')?.getAttribute('src')).toBe(ACME.src);
  });

  it('puts the mark at the top of the rail, or at its foot under a customer logo', () => {
    const plain = render(
      <>
        <BrandRailTop />
        <BrandRailFoot version="0.4.0" />
      </>,
    );
    expect(plain.getByRole('img', { name: 'Bemmoly' })).toBeTruthy();
    expect(plain.queryByRole('button')).toBeNull();
    plain.unmount();
    render(
      <>
        <BrandRailTop customLogo={ACME} />
        <BrandRailFoot customLogo={ACME} version="0.4.0" />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Acme Labs' })).toBeTruthy();
    expect(screen.getByRole('button', { name: "Bemmoly 0.4.0 · What's new" })).toBeTruthy();
  });

  it('crops the wordmark to its letters so it sits on a text line', () => {
    const svg = trimmed(BRAND_FILES.wordmark.color);
    const [, , , , height] = /viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg) ?? [];
    expect(Number(height)).toBeLessThan(15);
    expect(Number(height)).toBeGreaterThan(12);
  });
});
