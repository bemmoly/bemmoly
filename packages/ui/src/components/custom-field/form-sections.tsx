import { useId, type ReactNode } from 'react';
import { FormGrid, FormGridItem } from '../form-layout/form-layout.tsx';

export interface FormSectionView {
  id: string;
  title?: string;
  description?: string;
  columns?: 1 | 2;
  items: readonly { key: string; full?: boolean; node: ReactNode }[];
}

/**
 * A form's sections, each a titled group of fields on the form grid. Sections without a
 * title read as one continuous form; the page owns the frame, the buttons and the submit.
 */
export function FormSections({ sections }: { sections: readonly FormSectionView[] }) {
  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <Section key={section.id} section={section} />
      ))}
    </div>
  );
}

function Section({ section }: { section: FormSectionView }) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={section.title ? titleId : undefined}
      className="flex flex-col gap-3.5"
    >
      {(section.title || section.description) && (
        <div className="flex flex-col gap-0.5">
          {section.title && (
            <h3 id={titleId} className="m-0 text-13 font-semibold">
              {section.title}
            </h3>
          )}
          {section.description && <p className="m-0 text-12 text-tx-3">{section.description}</p>}
        </div>
      )}
      <FormGrid columns={section.columns ?? 1} className="max-sm:grid-cols-1">
        {section.items.map((item) => (
          <FormGridItem key={item.key} full={item.full}>
            {item.node}
          </FormGridItem>
        ))}
      </FormGrid>
    </section>
  );
}
