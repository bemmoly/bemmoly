import { describe, expect, it } from 'vitest';
import { matchUriTemplate, mcpToolName } from './names.ts';

describe('mcp names', () => {
  it('turns an AI tool name into a dotted MCP name', () => {
    expect(mcpToolName('work_search_issues')).toBe('work.search_issues');
    expect(mcpToolName('docs_get_page')).toBe('docs.get_page');
    expect(mcpToolName('bemmoly.search')).toBe('bemmoly.search');
  });

  it('matches one path segment per template variable', () => {
    const template = 'bemmoly://work/issues/{key}';
    expect(matchUriTemplate(template, 'bemmoly://work/issues/PLT-204')).toEqual({ key: 'PLT-204' });
    expect(matchUriTemplate(template, 'bemmoly://work/issues/PLT-204/x')).toBeNull();
    expect(matchUriTemplate(template, 'bemmoly://docs/issues/PLT-204')).toBeNull();
    expect(matchUriTemplate('bemmoly://docs/spaces/{key}', 'bemmoly://docs/spaces/A%20B')).toEqual({
      key: 'A B',
    });
    expect(matchUriTemplate(template, 'bemmoly://work/issues/%E0%A4%A')).toBeNull();
  });
});
