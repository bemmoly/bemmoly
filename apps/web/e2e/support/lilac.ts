import type { Page } from '@playwright/test';

export interface LilacHit {
  tag: string;
  className: string;
  text: string;
  why: string[];
}

/**
 * Every visible element drawn with an AI token: by its class (`bg-ai-50`, `text-ai-600`,
 * `border-l-ai`…) or by a computed colour that resolves to one of the `ai` tokens in the
 * current theme, pseudo-elements included. The brand mark keeps its own lilac and is skipped
 * by its literal fill; a colour that only reaches an element by inheritance, with no text or
 * shape of its own to draw, draws nothing and is skipped too.
 */
export function lilacOn(page: Page): Promise<LilacHit[]> {
  return page.evaluate(() => {
    const probe = document.createElement('div');
    document.body.append(probe);
    const resolve = (value: string) => {
      probe.style.color = '';
      probe.style.color = value;
      return getComputedStyle(probe).color;
    };
    const root = getComputedStyle(document.documentElement);
    const tokens = ['--ai', '--ai-600', '--ai-100', '--ai-50']
      .map((name) => root.getPropertyValue(name).trim())
      .filter(Boolean)
      .map(resolve);
    probe.remove();
    const tokenClass =
      /(^|[\s:])(bg|text|border|border-[lrtbxy]|fill|stroke|ring|outline|from|to|via|decoration|shadow|caret)-ai(-\d+)?(\/\d+)?(\s|$)/;
    const shapes = new Set(['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'g', 'use']);
    const props = [
      'color',
      'backgroundColor',
      'borderTopColor',
      'borderRightColor',
      'borderBottomColor',
      'borderLeftColor',
      'fill',
      'stroke',
      'outlineColor',
      'boxShadow',
      'backgroundImage',
    ] as const;
    const hits: { tag: string; className: string; text: string; why: string[] }[] = [];
    for (const el of document.querySelectorAll<HTMLElement | SVGElement>('body *')) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (/#9a85ea/i.test(el.getAttribute('fill') ?? '')) continue;
      const className = el.getAttribute('class') ?? '';
      const why = tokenClass.test(className) ? ['class'] : [];
      const tag = el.tagName.toLowerCase();
      const ownText = [...el.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      );
      for (const pseudo of [null, '::before', '::after']) {
        const style = getComputedStyle(el, pseudo);
        if (pseudo && style.content === 'none') continue;
        for (const prop of props) {
          const value = style[prop];
          if (!value || !tokens.some((token) => value.includes(token))) continue;
          if (
            prop.startsWith('border') &&
            style[prop.replace('Color', 'Width') as 'borderTopWidth'] === '0px'
          )
            continue;
          if (prop === 'outlineColor' && style.outlineStyle === 'none') continue;
          if (prop === 'color' && !pseudo && !ownText && !shapes.has(tag)) continue;
          why.push(`${pseudo ?? ''}${prop}`);
        }
      }
      if (why.length) {
        hits.push({
          tag,
          className: className.slice(0, 120),
          text: (el.textContent ?? '').trim().slice(0, 60),
          why,
        });
      }
    }
    return hits;
  });
}
