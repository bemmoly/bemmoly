import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { diffLines } from './diff.ts';
import { parsePromptFile, PromptFileError } from './parse.ts';
import { createPromptService } from './service.ts';

const SUMMARY = `---
id: work.issue_summary
version: 2
role: standard
description: Summarise an issue with citations
variables: [title, context]
output_schema: work.issue_summary
---
# System

You summarise issues. Cite sources as [c1].

# Prompt

Issue: {{title}}

{{ context }}
`;

describe('prompt files', () => {
  it('parses frontmatter and splits system from the prompt', () => {
    const prompt = parsePromptFile(SUMMARY, 'summary.md');
    expect(prompt).toMatchObject({
      id: 'work.issue_summary',
      version: 2,
      role: 'standard',
      variables: ['title', 'context'],
      output_schema: 'work.issue_summary',
    });
    expect(prompt.system).toBe('You summarise issues. Cite sources as [c1].');
    expect(prompt.template).toBe('Issue: {{title}}\n\n{{ context }}');
  });

  it('refuses an undeclared variable and an unused one', () => {
    expect(() => parsePromptFile(SUMMARY.replace('{{title}}', '{{key}}'), 'x.md')).toThrow(
      /undeclared variables key/,
    );
    expect(() =>
      parsePromptFile(SUMMARY.replace('[title, context]', '[title, context, extra]'), 'x.md'),
    ).toThrow(/never uses: extra/);
  });

  it('needs a # Prompt section and valid frontmatter', () => {
    expect(() => parsePromptFile(SUMMARY.replace('# Prompt', '## Prompt'), 'x.md')).toThrow(
      PromptFileError,
    );
    expect(() =>
      parsePromptFile(SUMMARY.replace('role: standard', 'role: embedding'), 'x.md'),
    ).toThrow(/role/);
  });
});

describe('prompt service', () => {
  const service = async (content = SUMMARY, moduleId = 'work') => {
    const dir = await mkdtemp(join(tmpdir(), 'bemmoly-prompts-'));
    const path = join(dir, 'summary.md');
    await writeFile(path, content);
    const prompts = createPromptService({ moduleFiles: [{ moduleId, path }] });
    await prompts.load();
    return prompts;
  };

  it('renders with the prompt ref and fills every variable', async () => {
    const prompts = await service();
    const rendered = await prompts.render('work.issue_summary', {
      title: 'Login fails',
      context: '[c1] comment',
    });
    expect(rendered).toMatchObject({
      role: 'standard',
      promptRef: { id: 'work.issue_summary', version: 2 },
      outputSchema: 'work.issue_summary',
    });
    expect(rendered.prompt).toBe('Issue: Login fails\n\n[c1] comment');
    await expect(prompts.render('work.issue_summary', { title: 'x' })).rejects.toThrow(/context/);
    await expect(prompts.render('work.missing', {})).rejects.toThrow(/no AI prompt/);
  });

  it("requires a module's prompt ids to carry its module id", async () => {
    await expect(service(SUMMARY, 'docs')).rejects.toThrow(/must start with "docs."/);
  });

  it('lists the default body for the override editor', async () => {
    const [listed] = await (await service()).list();
    expect(listed?.defaultTemplate).toContain('# System');
    expect(listed?.override).toBeNull();
  });
});

describe('diffLines', () => {
  it('marks removed and added lines around shared ones', () => {
    expect(diffLines('a\nb\nc', 'a\nx\nc')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'removed', text: 'b' },
      { kind: 'added', text: 'x' },
      { kind: 'same', text: 'c' },
    ]);
  });
});
