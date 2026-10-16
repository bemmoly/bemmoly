/** The contract's longest line; longer output is cut into several lines rather than refused. */
export const MAX_LINE_LENGTH = 64_000;

/**
 * How much of an unterminated line is held back when it is cut for length: a secret that
 * starts in the held text and ends in the next chunk is then masked whole.
 */
const HOLD = 8 * 1024;

/**
 * Turns a byte stream into whole lines. Partial lines wait for the next chunk, carriage-return
 * progress bars keep their last frame, and multi-byte characters split across chunks survive.
 * A line too long to send is masked before it is cut, so a cut never splits a secret in two.
 */
export class LineSplitter {
  private pending = '';
  private readonly decoder = new TextDecoder('utf-8');

  private readonly onLine: (line: string) => void;
  private readonly mask: (text: string) => string;

  constructor(onLine: (line: string) => void, mask: (text: string) => string = (text) => text) {
    this.onLine = onLine;
    this.mask = mask;
  }

  push(chunk: Uint8Array | string): void {
    this.pending +=
      typeof chunk === 'string' ? chunk : this.decoder.decode(chunk, { stream: true });
    let index = this.pending.indexOf('\n');
    while (index !== -1) {
      this.emit(this.pending.slice(0, index));
      this.pending = this.pending.slice(index + 1);
      index = this.pending.indexOf('\n');
    }
    if (this.pending.length > MAX_LINE_LENGTH) {
      const masked = this.mask(this.pending);
      let cut = masked.length - HOLD;
      // Never cut between the two halves of a surrogate pair.
      if (/[\uD800-\uDBFF]/.test(masked.charAt(cut - 1))) cut -= 1;
      if (cut > 0) {
        this.emit(masked.slice(0, cut));
        this.pending = masked.slice(cut);
      } else {
        this.pending = masked;
      }
    }
  }

  end(): void {
    this.pending += this.decoder.decode();
    if (this.pending.length > 0) this.emit(this.pending);
    this.pending = '';
  }

  private emit(raw: string): void {
    const withoutCr = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    const lastFrame = withoutCr.includes('\r')
      ? withoutCr.slice(withoutCr.lastIndexOf('\r') + 1)
      : withoutCr;
    const text = lastFrame.length > MAX_LINE_LENGTH ? this.mask(lastFrame) : lastFrame;
    for (const piece of cutLongLine(text)) this.onLine(piece);
  }
}

export function cutLongLine(line: string): string[] {
  if (line.length <= MAX_LINE_LENGTH) return [line];
  const pieces: string[] = [];
  for (let start = 0; start < line.length; start += MAX_LINE_LENGTH) {
    pieces.push(line.slice(start, start + MAX_LINE_LENGTH));
  }
  return pieces;
}

const ESC = String.fromCharCode(27);
/** Colour and cursor codes, built from a string because a regex literal may not hold ESC. */
const ANSI = new RegExp(`${ESC}\\[[0-9;?]*[A-Za-z]`, 'g');

export const stripAnsi = (line: string): string => line.replace(ANSI, '');

/** A dim line, for what the runner says about a step as opposed to what the step printed. */
export const dim = (text: string): string => `\u001b[2m${text}\u001b[22m`;
