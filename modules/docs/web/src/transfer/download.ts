/*
 * Exports download from the export route with the session cookie, named by the server.
 */

/** Starts a download of `url` without leaving the page. */
export function download(url: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = '';
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
}
