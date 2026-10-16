/** The contract's longest line; longer output is cut into several lines rather than refused. */
export const MAX_LINE_LENGTH = 64_000;

/**
 * Turns a byte stream into whole lines. Partial lines wait for the next chunk, carriage-return
 * progress bars keep their last frame, and multi-byte characters split across chunks survive.
 */
export class LineSplitter {
  private pending = '';
  private readonly decoder = new TextDecoder('utf-8');

  private readonly onLine: (line: string) => void;

  constructor(onLine: (line: string) => void) {
    this.onLine = onLine;
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
      this.emit(this.pending);
      this.pending = '';
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
    for (const piece of cutLongLine(lastFrame)) this.onLine(piece);
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
