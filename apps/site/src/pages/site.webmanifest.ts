import icon192 from '@bemmoly/ui/brand/generated/icon-192.png';
import icon512 from '@bemmoly/ui/brand/generated/icon-512.png';
import maskable192 from '@bemmoly/ui/brand/generated/icon-maskable-192.png';
import maskable512 from '@bemmoly/ui/brand/generated/icon-maskable-512.png';
import { themeById } from '@bemmoly/ui/tokens';
import type { APIRoute } from 'astro';

const icon = (src: string, size: number, purpose: 'any' | 'maskable') => ({
  src,
  sizes: `${size}x${size}`,
  type: 'image/png',
  purpose,
});

export const GET: APIRoute = () => {
  const classic = themeById('light').colors;
  const manifest = {
    name: 'Bemmoly',
    short_name: 'Bemmoly',
    description: 'Your work. Your platform. Open source issues and docs on your own server.',
    start_url: '/',
    display: 'browser',
    background_color: classic.card,
    theme_color: classic.acc,
    icons: [
      icon(icon192.src, 192, 'any'),
      icon(icon512.src, 512, 'any'),
      icon(maskable192.src, 192, 'maskable'),
      icon(maskable512.src, 512, 'maskable'),
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'Content-Type': 'application/manifest+json' },
  });
};
