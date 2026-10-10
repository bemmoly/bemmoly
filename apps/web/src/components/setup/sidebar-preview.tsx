import { BrandBlock, type CustomerLogo } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';

const ROWS: ReadonlyArray<{ icon: IconName; name: string }> = [
  { icon: 'home', name: 'Home' },
  { icon: 'inbox', name: 'Inbox' },
  { icon: 'board', name: 'Work' },
  { icon: 'doc', name: 'Docs' },
];

interface SidebarPreviewProps {
  workspaceName: string;
  customLogo?: CustomerLogo | null;
  /** Fewer rows where the preview sits beside another one. */
  rows?: number;
  caption: string;
}

/**
 * The top of the real sidebar, drawn with the real BrandBlock, so what is typed shows where
 * people will see it. Inert: it is a picture, not navigation.
 */
export function SidebarPreview({ workspaceName, customLogo, rows = 4, caption }: SidebarPreviewProps) {
  return (
    <figure className="m-0 flex flex-col gap-2">
      <div
        aria-hidden="true"
        inert
        className="flex w-full flex-col gap-0.5 overflow-hidden rounded-card border border-line bg-side p-2 shadow-e1"
      >
        <BrandBlock workspaceName={workspaceName} customLogo={customLogo ?? null} />
        {ROWS.slice(0, rows).map((row, index) => (
          <span
            key={row.name}
            className={`flex h-7 items-center gap-2 rounded-control px-2 text-13 ${
              index === 0 ? 'bg-hover font-medium text-tx' : 'text-tx-2'
            }`}
          >
            <Icon name={row.icon} size={15} />
            {row.name}
          </span>
        ))}
      </div>
      <figcaption className="text-12 text-tx-3">{caption}</figcaption>
    </figure>
  );
}
