/** The slice of opentype.js the brand build uses; the package ships no types. */
declare module 'opentype.js' {
  interface PathCommand {
    type: 'M' | 'L' | 'C' | 'Q' | 'Z';
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }
  interface Path {
    commands: PathCommand[];
    toPathData(decimals?: number): string;
  }
  interface Glyph {
    advanceWidth: number;
    getPath(x: number, y: number, fontSize: number): Path;
  }
  interface Font {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    charToGlyph(char: string): Glyph;
  }
  const opentype: { parse(buffer: ArrayBuffer): Font };
  export default opentype;
}
