import type { ReactNode } from 'react';
import { Logo } from './Logo.tsx';

/**
 * PLACEHOLDER for @bemmoly/ui TopBar, measured from the Home and People
 * mocks: 48px, 16px left and 12px right padding, the logo cell divided from
 * the navigation by a hairline.
 */
export interface TopBarProps {
  /** The router link wrapping the logo; receives the classes it must apply. */
  renderHome: (className: string, children: ReactNode) => ReactNode;
  workspaceName: string;
  navigation: ReactNode;
  create?: ReactNode;
  trailing?: ReactNode;
}

export function TopBar({ renderHome, workspaceName, navigation, create, trailing }: TopBarProps) {
  return (
    <header className="flex h-topbar shrink-0 items-center gap-1 border-b border-br bg-sf pr-3 pl-4">
      {renderHome(
        'mr-1.5 flex h-7 items-center gap-2.25 border-r border-br pr-3.5 text-tx no-underline',
        <>
          <Logo size={24} />
          <span className="text-brand font-semibold tracking-[-0.01em]">{workspaceName}</span>
        </>,
      )}
      {navigation}
      {create}
      <div className="ml-auto flex items-center gap-2">{trailing}</div>
    </header>
  );
}
