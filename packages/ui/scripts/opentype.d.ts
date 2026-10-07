/** The slice of opentype.js the brand build uses; the package ships no types. */
declare module 'opentype.js' {
  interface Path {
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
