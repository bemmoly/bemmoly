import type { ReportResult } from '@bemmoly/module-work/shared';
import { Dropdown, MenuItem } from '@bemmoly/ui';
import type { RefObject } from 'react';
import { chartPng, reportCsv, reportFileName, reportJson, saveFile } from './report-export.ts';

/** The first painted background behind the chart, so the PNG looks as the card does. */
function backgroundOf(element: HTMLElement): string {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const colour = getComputedStyle(node).backgroundColor;
    if (colour && colour !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(colour)) return colour;
  }
  return getComputedStyle(document.body).backgroundColor;
}

/**
 * Export a built report: CSV and JSON always, PNG when it is drawn as a chart. `figure` is
 * the element the chart is drawn in.
 */
export function ExportMenu({
  result,
  question,
  figure,
}: {
  result: ReportResult;
  question: string;
  figure: RefObject<HTMLElement | null>;
}) {
  const title = result.spec.title;
  const svg = () => figure.current?.querySelector<SVGSVGElement>('svg[role="img"]') ?? null;
  const drawn = result.spec.chart === 'bar' && result.rows.length > 0;
  return (
    <Dropdown label="Export" align="end" buttonProps={{ size: 'sm', variant: 'ghost' }}>
      <MenuItem
        onSelect={() =>
          saveFile(
            reportFileName(title, 'csv'),
            new Blob([reportCsv(result)], { type: 'text/csv' }),
          )
        }
      >
        CSV
      </MenuItem>
      <MenuItem
        onSelect={() =>
          saveFile(
            reportFileName(title, 'json'),
            new Blob([reportJson(result, question)], { type: 'application/json' }),
          )
        }
      >
        JSON
      </MenuItem>
      {drawn && (
        <MenuItem
          onSelect={() => {
            const chart = svg();
            if (!chart || !figure.current) return;
            void chartPng(chart, backgroundOf(figure.current)).then((blob) =>
              saveFile(reportFileName(title, 'png'), blob),
            );
          }}
        >
          PNG
        </MenuItem>
      )}
    </Dropdown>
  );
}
