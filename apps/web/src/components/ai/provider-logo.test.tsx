import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BUNDLED_CATALOG } from '../../hooks/use-ai-catalog.ts';
import { providerLogoIds, providerLogoUrl } from '../../lib/provider-logos.ts';
import { ProviderLogo } from './provider-logo.tsx';

/** models.dev answers with its placeholder glyph for these, so no file is bundled. */
const WITHOUT_LOGO = ['github-models', 'requesty', 'upstage'];

describe('ProviderLogo', () => {
  it('bundles a logo for every catalog provider except the known placeholders', () => {
    const ids = BUNDLED_CATALOG.providers.map((provider) => provider.id);
    expect(providerLogoIds().sort()).toEqual(ids.filter((id) => !WITHOUT_LOGO.includes(id)).sort());
  });

  it('paints the bundled monochrome file in the primary text colour', () => {
    const [id] = providerLogoIds();
    const { container } = render(<ProviderLogo id={id ?? ''} name="Some Provider" />);
    const mask = container.querySelector('[data-logo]');
    expect(mask?.getAttribute('data-logo')).toBe(providerLogoUrl(id ?? ''));
    expect(mask?.className).toContain('bg-tx');
    expect(mask?.className).not.toMatch(/bg-(current|tx[2-6])/);
    expect(container.textContent).toBe('');
  });

  it('falls back to initials for a provider without a bundled logo', () => {
    const { container } = render(<ProviderLogo id="not-in-the-bundle" name="Future Labs" />);
    expect(providerLogoUrl('not-in-the-bundle')).toBeNull();
    expect(container.querySelector('[data-logo]')).toBeNull();
    expect(container.textContent).toBe('FL');
  });
});
