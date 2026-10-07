import { writeFileSync } from 'node:fs';
import { renderTailwindCss, renderThemeCss } from '../src/css.ts';

writeFileSync(new URL('../src/theme.css', import.meta.url), renderThemeCss());
writeFileSync(new URL('../src/tailwind.css', import.meta.url), renderTailwindCss());
