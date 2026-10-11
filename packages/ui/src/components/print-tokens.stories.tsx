import type { Meta, StoryObj } from '@storybook/react-vite';
import { PRINT_LEADING, PRINT_PAPERS, PRINT_TYPE } from '../tokens/print.ts';

/**
 * The print scale as a page of paper shows it: what a PDF export or the browser's print view
 * sets type in. Always light, as paper is.
 */
const SAMPLES: readonly { step: keyof typeof PRINT_TYPE; text: string }[] = [
  { step: 'h1', text: 'Auth service migration' },
  { step: 'h2', text: 'Migration order' },
  { step: 'h3', text: 'Owners' },
  {
    step: 'body',
    text: 'Move sessions from Redis to Postgres behind a flag; dual-write, cut reads.',
  },
  { step: 'small', text: 'const ttl = 30 * time.Minute' },
  { step: 'meta', text: 'Auth service migration · 3 / 12' },
];

function PrintScale() {
  return (
    <div className="flex flex-col gap-6 font-sans text-13 text-tx">
      <div className="flex flex-col gap-2 rounded-card border border-line bg-card p-6">
        {SAMPLES.map((sample) => (
          <div key={sample.step} className="flex items-baseline gap-4">
            <span className="w-24 shrink-0 text-11 text-tx-3">
              {sample.step} · {PRINT_TYPE[sample.step]}
            </span>
            <span
              style={{
                fontSize: PRINT_TYPE[sample.step],
                lineHeight: sample.step === 'body' ? PRINT_LEADING.body : PRINT_LEADING.heading,
              }}
            >
              {sample.text}
            </span>
          </div>
        ))}
      </div>
      <p className="m-0 text-12 text-tx-3">
        Papers:{' '}
        {Object.values(PRINT_PAPERS)
          .map((paper) => `${paper.label} ${paper.width} × ${paper.height}`)
          .join(', ')}
      </p>
    </div>
  );
}

const meta = {
  title: 'Design system/Print',
  component: PrintScale,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PrintScale>;

export default meta;

export const Scale: StoryObj<typeof meta> = {};
