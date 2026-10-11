/*
 * AI tool names use an underscore after the module because model APIs allow no dots
 * (`work_search_issues`); MCP names are namespaced with a dot (`work.search_issues`).
 */

/** `work_search_issues` → `work.search_issues`; a name already dotted is kept. */
export function mcpToolName(name: string): string {
  if (name.includes('.')) return name;
  const at = name.indexOf('_');
  return at < 0 ? name : `${name.slice(0, at)}.${name.slice(at + 1)}`;
}

const VARIABLE = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches a URI against a level-one template (`bemmoly://work/issues/{key}`), each variable
 * standing for one path segment. Null when it does not match.
 */
export function matchUriTemplate(template: string, uri: string): Record<string, string> | null {
  const names: string[] = [];
  let pattern = '';
  let last = 0;
  for (const match of template.matchAll(VARIABLE)) {
    pattern += escapeRegExp(template.slice(last, match.index));
    pattern += '([^/?#]+)';
    names.push(match[1] ?? '');
    last = match.index + match[0].length;
  }
  pattern += escapeRegExp(template.slice(last));
  const found = new RegExp(`^${pattern}$`).exec(uri);
  if (!found) return null;
  const params: Record<string, string> = {};
  try {
    names.forEach((name, index) => {
      params[name] = decodeURIComponent(found[index + 1] ?? '');
    });
  } catch {
    return null;
  }
  return params;
}
