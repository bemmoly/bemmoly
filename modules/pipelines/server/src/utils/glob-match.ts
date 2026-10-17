/*
 * Matching a glob without a regular expression. Patterns and paths here come from
 * repositories (paths: filters, CODEOWNERS, workspace lists) and from CI claims, and a
 * regular expression with several `*` backtracks for minutes on a crafted path, blocking
 * the server. This walks every position of the pattern at once instead (a Thompson
 * automaton), so a match costs at most path length times pattern length.
 */

export type GlobToken =
  | { kind: 'char'; char: string }
  /** `?`: one character that is not "/". */
  | { kind: 'one' }
  /** `*`: any run without "/". */
  | { kind: 'star' }
  /** `**`: any run, "/" included. */
  | { kind: 'any' }
  /** `**` then "/": nothing, or any run that ends in "/". */
  | { kind: 'dirs' }
  /** `{a,b}`: one of several token runs. */
  | { kind: 'either'; options: GlobToken[][] };

export interface GlobMatcher {
  test(path: string): boolean;
}

type Edge = { to: number; accepts: (char: string) => boolean };

const anything = () => true;
const notSlash = (char: string) => char !== '/';
const slash = (char: string) => char === '/';

class Automaton {
  readonly edges: Edge[][] = [];
  readonly skips: number[][] = [];

  node(): number {
    this.edges.push([]);
    this.skips.push([]);
    return this.edges.length - 1;
  }

  edge(from: number, to: number, accepts: (char: string) => boolean): void {
    this.edges[from]?.push({ to, accepts });
  }

  skip(from: number, to: number): void {
    this.skips[from]?.push(to);
  }

  /** Builds `tokens` from `start`; returns the node reached at their end. */
  build(tokens: readonly GlobToken[], start: number): number {
    let at = start;
    for (const token of tokens) {
      const next = this.node();
      if (token.kind === 'char') {
        const { char } = token;
        this.edge(at, next, (c) => c === char);
      } else if (token.kind === 'one') {
        this.edge(at, next, notSlash);
      } else if (token.kind === 'star' || token.kind === 'any') {
        // The loop gets a node of its own so it never repeats another token's way out.
        const loop = this.node();
        this.skip(at, loop);
        this.edge(loop, loop, token.kind === 'star' ? notSlash : anything);
        this.skip(loop, next);
      } else if (token.kind === 'dirs') {
        const inside = this.node();
        this.skip(at, next);
        this.edge(at, inside, anything);
        this.edge(inside, inside, anything);
        this.edge(inside, next, slash);
        this.edge(at, next, slash);
      } else {
        for (const option of token.options) {
          const entry = this.node();
          this.skip(at, entry);
          this.skip(this.build(option, entry), next);
        }
      }
      at = next;
    }
    return at;
  }

  close(states: Set<number>): Set<number> {
    const stack = [...states];
    for (let state = stack.pop(); state !== undefined; state = stack.pop()) {
      for (const to of this.skips[state] ?? []) {
        if (!states.has(to)) {
          states.add(to);
          stack.push(to);
        }
      }
    }
    return states;
  }
}

export function globMatcher(tokens: readonly GlobToken[]): GlobMatcher {
  const automaton = new Automaton();
  const start = automaton.node();
  const accept = automaton.build(tokens, start);
  return {
    test(path) {
      let states = automaton.close(new Set([start]));
      // By UTF-16 unit, as the patterns are read, so "?" and literals agree on what a character is.
      for (let i = 0; i < path.length; i += 1) {
        const char = path[i] ?? '';
        const next = new Set<number>();
        for (const state of states) {
          for (const edge of automaton.edges[state] ?? []) {
            if (edge.accepts(char)) next.add(edge.to);
          }
        }
        if (next.size === 0) return false;
        states = automaton.close(next);
      }
      return states.has(accept);
    },
  };
}

/** `*` within a segment, `**` across segments, and with `question`, `?` for one character. */
export function simpleGlobTokens(glob: string, options: { question: boolean }): GlobToken[] {
  const tokens: GlobToken[] = [];
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i] ?? '';
    if (char === '*' && glob[i + 1] === '*') {
      tokens.push({ kind: 'any' });
      i += 1;
    } else if (char === '*') tokens.push({ kind: 'star' });
    else if (char === '?' && options.question) tokens.push({ kind: 'one' });
    else tokens.push({ kind: 'char', char });
  }
  return tokens;
}
