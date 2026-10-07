/**
 * Shows a crop of a real mock next to a story. The mock is served by Storybook from
 * docs/design/mocks (see main.ts) and rendered at 1:1 in an iframe, then clipped to the region
 * the component comes from, so both sides are at the same zoom.
 */
import type { ReactNode } from 'react';

export interface MockCrop {
  /** File name in docs/design/mocks, e.g. "Bemmoly Board.dc.html". */
  file: string;
  /** Region of the mock page in CSS px at a 1440 x 900 viewport. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Viewport the mock is laid out in; defaults to 1440 x 900. */
  viewport?: { width: number; height: number };
  note?: string;
}

export function MockFrame({ crop }: { crop: MockCrop }) {
  const { width, height } = crop.viewport ?? { width: 1440, height: 900 };
  return (
    <div
      className="relative overflow-hidden rounded-card border border-br bg-sf"
      style={{ width: crop.w, height: crop.h }}
    >
      <iframe
        title={`Mock: ${crop.file}`}
        src={`./mocks/${encodeURIComponent(crop.file)}`}
        loading="lazy"
        className="pointer-events-none absolute top-0 left-0 border-0"
        style={{ width, height, transform: `translate(${-crop.x}px, ${-crop.y}px)` }}
      />
    </div>
  );
}

function Column({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="text-11 font-medium tracking-caps text-tx5 uppercase">{label}</div>
      {children}
    </div>
  );
}

export function SideBySide({ crops, children }: { crops: MockCrop[]; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-8">
      <Column label="Component">{children}</Column>
      <Column label="Mock">
        {crops.map((crop) => (
          <div key={`${crop.file}-${crop.x}-${crop.y}`} className="flex flex-col gap-1">
            <MockFrame crop={crop} />
            <div className="text-11 text-tx5">
              {crop.file} @ {crop.x},{crop.y} {crop.w}x{crop.h}
              {crop.note ? ` · ${crop.note}` : ''}
            </div>
          </div>
        ))}
      </Column>
    </div>
  );
}
