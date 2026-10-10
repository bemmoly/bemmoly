/**
 * The captured pictures behind each preview (scripts/capture-previews.ts writes them), light
 * and dark. tests/demo.test.ts checks every preview has both and that each route has data.
 */
import type { ImageMetadata } from 'astro';
import backlogDark from '../assets/previews/backlog-dark.png';
import backlog from '../assets/previews/backlog.png';
import boardDark from '../assets/previews/board-dark.png';
import boardPhoneDark from '../assets/previews/board-phone-dark.png';
import boardPhone from '../assets/previews/board-phone.png';
import board from '../assets/previews/board.png';
import docsDark from '../assets/previews/docs-dark.png';
import docs from '../assets/previews/docs.png';
import issueDark from '../assets/previews/issue-dark.png';
import issue from '../assets/previews/issue.png';
import type { PreviewId } from './previews.ts';

export interface PosterPair {
  light: ImageMetadata;
  dark: ImageMetadata;
}

export const POSTERS: Readonly<Record<PreviewId, PosterPair>> = {
  board: { light: board, dark: boardDark },
  docs: { light: docs, dark: docsDark },
  issue: { light: issue, dark: issueDark },
  backlog: { light: backlog, dark: backlogDark },
};

export const PHONE_POSTERS: PosterPair = { light: boardPhone, dark: boardPhoneDark };

/** Widths for a desktop poster: a phone, the showcase's 724px at 1x and 2x, the hero at 2x. */
export const POSTER_WIDTHS = [640, 1200, 1800, 2560] as const;
