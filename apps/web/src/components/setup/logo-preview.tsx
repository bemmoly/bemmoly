import { ComingSoonBadge } from './choice-card.tsx';
import { SidebarPreview } from './sidebar-preview.tsx';

/**
 * A stand-in for the logo they will upload: their initial on their brand colour, as an image,
 * because the brand block draws an uploaded logo as an image. It is example data showing where
 * a logo goes, not styling, so it carries the chosen colour rather than a token.
 */
export function sampleLogo(name: string, brand: string): string {
  const letter = (name.trim().charAt(0) || 'A').toUpperCase().replace(/[<&>"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26"><rect width="26" height="26" fill="${brand}"/><text x="13" y="18" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="600" fill="#fff">${letter}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

interface LogoPreviewProps {
  workspaceName: string;
  brand: string;
}

/**
 * Logo upload is coming soon, but where a logo goes is shown now: today's sidebar beside the
 * same sidebar with their logo leading and "on Bemmoly" under it, which stays.
 */
export function LogoPreview({ workspaceName, brand }: LogoPreviewProps) {
  return (
    <section aria-labelledby="setup-logo" className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <h2 id="setup-logo" className="m-0 text-13 font-semibold text-tx">
          Your logo
        </h2>
        <ComingSoonBadge />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SidebarPreview workspaceName={workspaceName} rows={0} caption="Today" />
        <SidebarPreview
          workspaceName={workspaceName}
          customLogo={{ name: workspaceName, src: sampleLogo(workspaceName, brand) }}
          rows={0}
          caption="With your logo. Bemmoly stays on the second line."
        />
      </div>
    </section>
  );
}
