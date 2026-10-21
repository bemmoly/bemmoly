import type { ReportResult, ReportUnit } from '@bemmoly/module-work/shared';

/*
 * A report leaves the page as a file: CSV for a spreadsheet, JSON with the spec beside the
 * numbers so it can be rebuilt, and PNG of the chart as drawn. Everything is built in the
 * browser from what is already on screen; nothing is sent anywhere.
 */

export const UNIT_LABELS: Record<ReportUnit, string> = {
  issues: 'Issues',
  points: 'Points',
  days: 'Days',
  percent: 'Percent',
};

const csvCell = (value: string | number) => {
  const text = String(value);
  // A leading = + - @ would run as a formula in a spreadsheet; a quote mark keeps it text.
  const safe = /^[=+\-@]/.test(text) && typeof value === 'string' ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function reportCsv(result: ReportResult): string {
  const unit = UNIT_LABELS[result.unit];
  const lines: (string | number)[][] = [['Group', unit, 'Issues counted']];
  if (result.rows.length === 0) lines.push(['All issues', result.total, result.issues]);
  for (const row of result.rows) lines.push([row.label, row.value, row.issues]);
  return `${lines.map((line) => line.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export function reportJson(result: ReportResult, question: string): string {
  return `${JSON.stringify({ question, ...result }, null, 2)}\n`;
}

/** A file name from the report's title: lowercase words joined by hyphens. */
export function reportFileName(title: string, extension: 'csv' | 'json' | 'png'): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'report'}.${extension}`;
}

export function saveFile(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const PAINT = [
  'fill',
  'stroke',
  'stroke-width',
  'font-family',
  'font-size',
  'font-weight',
  'opacity',
];

/**
 * The chart's SVG as a standalone picture: the theme's colours come from classes, so each
 * element's computed paint is copied inline before the SVG leaves the page.
 */
function standaloneSvg(svg: SVGSVGElement): string {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const from = [svg, ...svg.querySelectorAll('*')];
  const to = [copy, ...copy.querySelectorAll('*')];
  from.forEach((element, index) => {
    const style = getComputedStyle(element);
    const target = to[index] as SVGElement | undefined;
    if (!target) return;
    for (const name of PAINT) {
      const value = style.getPropertyValue(name);
      if (value) target.style.setProperty(name, value);
    }
  });
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(copy);
}

/** Draws the chart on the card's own background at twice its size, as a PNG. */
export async function chartPng(svg: SVGSVGElement, background: string): Promise<Blob> {
  const width = svg.width.baseVal.value || svg.clientWidth;
  const height = svg.height.baseVal.value || svg.clientHeight;
  const image = new Image();
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(standaloneSvg(svg))}`;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('The chart could not be drawn as a picture'));
    image.src = source;
  });
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot draw pictures');
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The picture could not be made'))),
      'image/png',
    ),
  );
}
