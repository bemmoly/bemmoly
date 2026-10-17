import { cx } from '../../lib/cx.ts';

export interface DeliverySparkProps {
  /** Deploys per period, oldest first: twelve weeks in the catalog. */
  values: readonly number[];
  /** Read instead of the bars: "41 deploys to Prod in 12 weeks". */
  label: string;
  className?: string;
}

const BAR = 4;
const GAP = 2;
const HEIGHT = 18;

/**
 * Small deploy-frequency bars for a row: accent where something shipped, a hairline where
 * nothing did, so a quiet application reads as quiet rather than as missing data. Scaled to
 * the row's own peak; the label carries the number.
 */
export function DeliverySpark({ values, label, className }: DeliverySparkProps) {
  const peak = Math.max(1, ...values);
  const width = values.length * (BAR + GAP) - GAP;
  return (
    <svg
      role="img"
      aria-label={label}
      width={width}
      height={HEIGHT}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      className={cx('block shrink-0', className)}
    >
      {values.map((value, index) => {
        const height = value > 0 ? Math.max(2, Math.round((value / peak) * HEIGHT)) : 1;
        return (
          <rect
            key={index}
            x={index * (BAR + GAP)}
            y={HEIGHT - height}
            width={BAR}
            height={height}
            rx={1}
            fill={value > 0 ? 'var(--acc-500)' : 'var(--line)'}
          />
        );
      })}
    </svg>
  );
}
