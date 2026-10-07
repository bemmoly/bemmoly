/** Vite's raw import: the file's text, used to inline the brand SVG files. */
declare module '*.svg?raw' {
  const content: string;
  export default content;
}
