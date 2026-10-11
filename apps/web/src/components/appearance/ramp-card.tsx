import type { ThemeCheck } from '@bemmoly/ui/theme';
import { Icon } from '@bemmoly/ui/icons';
import type { ThemeMode, ThemeSource } from '@bemmoly/ui/tokens';
import { themeScope } from '../../lib/theme-scope.ts';
import { BoardMiniature } from '../setup/board-miniature.tsx';

interface RampCardProps {
  source: ThemeSource;
  mode: ThemeMode;
  checks: readonly ThemeCheck[];
}

const SWATCHES = [
  { token: 'acc', label: 'Links', className: 'bg-acc' },
  { token: 'acc-fill', label: 'Button', className: 'bg-acc-fill' },
  { token: 'acc-50', label: 'Selected', className: 'bg-acc-50' },
  { token: 'acc-100', label: 'Border', className: 'bg-acc-100' },
] as const;

/**
 * One generated set, as the review's Custom colour screen draws it: how many of the fourteen
 * checks pass, the four accent tokens with their values, and the Board painted with the set.
 */
export function RampCard({ source, mode, checks }: RampCardProps) {
  const set = source[mode];
  const passed = checks.filter((check) => check.pass).length;
  const failed = checks.filter((check) => !check.pass);
  const scope = themeScope(source, mode);
  return (
    <section
      aria-label={mode === 'light' ? 'Light' : 'Dark'}
      className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-card p-3.5"
    >
      <div className="flex items-center gap-2">
        <Icon name={mode === 'light' ? 'sun' : 'moon'} size={14} />
        <span className="font-semibold">{mode === 'light' ? 'Light' : 'Dark'}</span>
        <span
          className={`ml-auto inline-flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-12 font-medium ${
            failed.length ? 'bg-red-50 text-red-tx' : 'bg-green-50 text-green-tx'
          }`}
        >
          <Icon name={failed.length ? 'warning' : 'check'} size={14} />
          {passed} of {checks.length} checks pass
        </span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {SWATCHES.map((swatch) => (
          <div key={swatch.token} className="flex flex-col items-start gap-0.5">
            <span
              {...scope}
              className={`h-7.5 w-11 rounded-control border border-line ${swatch.className}`}
            />
            <span className="font-mono text-11 text-tx-3">{swatch.label}</span>
            <span className="font-mono text-11 text-tx">{set[swatch.token]}</span>
          </div>
        ))}
      </div>
      <BoardMiniature scope={scope} />
      {failed.length ? (
        <ul className="m-0 pl-4 text-12 text-red-tx">
          {failed.map((check) => (
            <li key={check.id}>
              {check.label}: {check.ratio.toFixed(2)}:1, needs {check.min}:1
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
