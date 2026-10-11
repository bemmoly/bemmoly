import { BrandBlock, BrandRailFoot, BrandRailTop, type CustomerLogo } from '@bemmoly/ui';
import type { ThemeMode, ThemeSource } from '@bemmoly/ui/tokens';
import { themeScope } from '../../lib/theme-scope.ts';

interface LogoPreviewProps {
  source: ThemeSource;
  workspaceName: string;
  logo: CustomerLogo | null;
}

/**
 * The real sidebar brand block and collapsed rail with the logo, in one mode of the theme. It
 * is inert: a picture of the shell, so the rail's What's new button does nothing here.
 */
function Pane({ source, workspaceName, logo, mode }: LogoPreviewProps & { mode: ThemeMode }) {
  return (
    <div
      {...themeScope(source, mode)}
      inert
      data-testid={`logo-preview-${mode}`}
      className="flex min-h-28 min-w-0 overflow-hidden rounded-card border border-line bg-side font-sans text-13 text-tx"
    >
      <div className="min-w-0 flex-1 p-3">
        <BrandBlock workspaceName={workspaceName} customLogo={logo} />
      </div>
      <div className="flex w-14 shrink-0 flex-col items-center justify-between gap-6 border-l border-line py-3">
        <BrandRailTop customLogo={logo} />
        <BrandRailFoot customLogo={logo} version="" />
      </div>
    </div>
  );
}

/** The logo where people will see it: the sidebar's line one and the rail, light and dark. */
export function LogoPreview(props: LogoPreviewProps) {
  return (
    <div
      role="img"
      aria-label={
        props.logo
          ? `Sidebar preview: ${props.workspaceName}'s logo, then "on Bemmoly"`
          : 'Sidebar preview: the Bemmoly lockup'
      }
      className="flex flex-col gap-2"
    >
      <Pane {...props} mode="light" />
      <Pane {...props} mode="dark" />
    </div>
  );
}
