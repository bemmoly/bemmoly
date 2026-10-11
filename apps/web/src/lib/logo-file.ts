import { LOGO_MAX_BYTES, LOGO_MAX_RATIO, LOGO_MIN_PX } from '@bemmoly/shared';

/*
 * The checks the server makes on a workspace logo, made first in the browser so a wrong file is
 * explained before it is sent. The server still reads the bytes and decides.
 */

export const LOGO_ACCEPT = 'image/png,image/svg+xml,image/webp,.png,.svg,.webp';

const TYPES = ['image/png', 'image/svg+xml', 'image/webp'];
const EXTENSIONS = /\.(png|svg|webp)$/i;

export const LOGO_HINT = `PNG, SVG or WebP, square, at least ${LOGO_MIN_PX} × ${LOGO_MIN_PX} px, up to 1 MB.`;

export type Measure = (file: Blob) => Promise<{ width: number; height: number } | null>;

/** The image's natural size, or null when the browser cannot draw it. */
export const measureImage: Measure = (file) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });

/** Why this file cannot be the logo, in words for the person; null when it looks right. */
export async function logoFileProblem(
  file: File,
  measure: Measure = measureImage,
): Promise<string | null> {
  if (!TYPES.includes(file.type) && !EXTENSIONS.test(file.name)) {
    return `${file.name} is not a PNG, SVG or WebP file.`;
  }
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > LOGO_MAX_BYTES) {
    return `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB; the logo can be up to 1 MB.`;
  }
  const size = await measure(file);
  if (!size) return `${file.name} could not be read as an image.`;
  const svg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  // An SVG without a size reports zero; its shape is checked on the server from its viewBox.
  if (size.width === 0 || size.height === 0) return svg ? null : `${file.name} could not be read.`;
  if (!svg && Math.min(size.width, size.height) < LOGO_MIN_PX) {
    return `${file.name} is ${size.width} × ${size.height} px; the logo needs at least ${LOGO_MIN_PX} × ${LOGO_MIN_PX} px.`;
  }
  const ratio = Math.max(size.width, size.height) / Math.min(size.width, size.height);
  if (ratio > LOGO_MAX_RATIO) {
    return `${file.name} is ${size.width} × ${size.height}; the logo needs to be square or nearly square.`;
  }
  return null;
}
