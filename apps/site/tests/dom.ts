/**
 * Reads built pages with an HTML parser rather than regular expressions, so tag case,
 * attribute order and end tags such as `</script >` cannot hide an element from a check.
 */
import { HtmlValidate, Parser, type HtmlElement } from 'html-validate';

const config = new HtmlValidate({ extends: [], rules: {} }).getConfigForSync('page.html');

export function parsePage(source: string): HtmlElement {
  return new Parser(config).parseHtml(source);
}

const attribute = (element: HtmlElement, name: string) => {
  const value = element.getAttribute(name)?.value;
  return typeof value === 'string' ? value : undefined;
};

export interface PageScript {
  src: string | undefined;
  type: string | undefined;
  body: string;
}

export function scriptsOf(page: HtmlElement): PageScript[] {
  return page.querySelectorAll('script').map((script) => ({
    src: attribute(script, 'src'),
    type: attribute(script, 'type'),
    body: script.textContent,
  }));
}

export function hrefsOf(page: HtmlElement): string[] {
  return page.querySelectorAll('a[href]').flatMap((link) => attribute(link, 'href') ?? []);
}

export function idsOf(page: HtmlElement): Set<string> {
  return new Set(page.querySelectorAll('[id]').flatMap((element) => element.id ?? []));
}
