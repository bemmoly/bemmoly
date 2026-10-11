import type { PdfPaper, PdfRenderer, PdfRenderInput } from '../contracts/pdf.ts';
import { HttpStatusError } from './http-json.ts';

/*
 * The PDF renderer's HTTP API: Gotenberg's Chromium route, run as an optional service
 * beside the app. Everything the page shows travels in the request (the HTML carries its
 * images as data: URIs), and the renderer is started with every host unresolvable and every
 * URL outside its own temp folder refused, so nothing a page contains can reach a network.
 */

export interface PdfRendererConfig {
  /** e.g. http://pdf:3000 on the Compose network. */
  baseUrl: string;
  /** The app's public URL, handed to callers for absolute links. */
  publicUrl: string;
  /** The whole render, upload to last byte. */
  timeoutMs: number;
  /** Bigger HTML is refused before it is sent; a bigger PDF is refused as it arrives. */
  maxHtmlBytes: number;
  maxPdfBytes: number;
}

/** Inches, as the renderer takes them. */
const PAPER: Record<PdfPaper, { width: string; height: string }> = {
  a4: { width: '8.27', height: '11.69' },
  letter: { width: '8.5', height: '11' },
};

/** 18mm top and bottom leave room for the running title and page numbers; 16mm sides. */
const MARGINS = {
  marginTop: '0.71',
  marginBottom: '0.71',
  marginLeft: '0.63',
  marginRight: '0.63',
};

export class PdfTooLargeError extends Error {
  override readonly name = 'PdfTooLargeError';
}

async function readCapped(response: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new PdfTooLargeError(`The PDF is over ${maxBytes} bytes`);
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (response.body) {
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > maxBytes) throw new PdfTooLargeError(`The PDF is over ${maxBytes} bytes`);
      chunks.push(chunk);
    }
  }
  return Buffer.concat(chunks);
}

const htmlBlob = (html: string) => new Blob([html], { type: 'text/html' });

export function createPdfRendererClient(config: PdfRendererConfig): PdfRenderer {
  const url = new URL('/forms/chromium/convert/html', config.baseUrl).toString();
  return {
    publicUrl: config.publicUrl,
    async render(input: PdfRenderInput) {
      if (Buffer.byteLength(input.html) > config.maxHtmlBytes) {
        throw new PdfTooLargeError(`The page is over ${config.maxHtmlBytes} bytes to print`);
      }
      const form = new FormData();
      form.append('files', htmlBlob(input.html), 'index.html');
      if (input.headerHtml) form.append('files', htmlBlob(input.headerHtml), 'header.html');
      if (input.footerHtml) form.append('files', htmlBlob(input.footerHtml), 'footer.html');
      const paper = PAPER[input.paper];
      form.append('paperWidth', paper.width);
      form.append('paperHeight', paper.height);
      for (const [key, value] of Object.entries(MARGINS)) form.append(key, value);
      form.append('printBackground', 'true');
      const response = await fetch(url, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(config.timeoutMs),
        redirect: 'error',
      });
      if (!response.ok) {
        throw new HttpStatusError(url, response.status, (await response.text()).slice(0, 2_000));
      }
      return readCapped(response, config.maxPdfBytes);
    },
  };
}
