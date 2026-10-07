import type { ReactNode } from 'react';
import { Logo } from '../../ui.ts';

/**
 * Sign-in pages: the Setup mock's 56px header, the Landing mock's tagline
 * treatment, and a 400px card using the Setup mock's form styling.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-tx">
      <header className="flex h-14 items-center gap-3 border-b border-br bg-sf px-8">
        <Logo variant="lockup" size={26} />
      </header>
      <main className="flex flex-1 flex-col items-center px-8 pt-16 pb-20">
        <div className="flex w-100 max-w-full flex-col gap-6">
          <div className="flex flex-col gap-2 text-center">
            <p className="m-0 text-display leading-[1.08] font-semibold tracking-[-.03em] text-balance">
              Your work. Your platform.
            </p>
            <p className="m-0 text-brand leading-[1.55] text-tx4">
              Issues and docs for your whole company, on your own server.
            </p>
          </div>
          <section
            className="flex flex-col gap-4 rounded-card border border-br bg-sf p-6"
            aria-labelledby="auth-title"
          >
            <div className="flex flex-col gap-1">
              <h1 id="auth-title" className="m-0 text-wordmark font-semibold">
                {title}
              </h1>
              {subtitle ? (
                <div className="text-small leading-normal text-tx4">{subtitle}</div>
              ) : null}
            </div>
            {children}
          </section>
        </div>
      </main>
    </div>
  );
}
