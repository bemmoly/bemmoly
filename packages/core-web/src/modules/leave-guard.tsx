import { createContext, useContext, useEffect, type ReactNode } from 'react';

/*
 * Holding a move away from unsaved work. Module chunks do not import the
 * shell's router, so the shell provides the implementation and a chunk asks
 * for it with useLeaveGuard: a top bar link, Back or a typed URL is held
 * while `when` is true, and closing or reloading the tab asks the browser's
 * own question.
 */

export interface LeaveGuardOptions {
  /** Hold navigation while this is true, typically while a draft is unsaved. */
  when: boolean;
  /**
   * Whether one move needs asking about; by default any change of path does,
   * so a search or hash change on the same page goes through.
   */
  shouldBlock?: (move: { from: string; to: string }) => boolean;
}

export interface LeaveGuard {
  /** A move is held until the person chooses to stay or leave. */
  blocked: boolean;
  /** Where the held move was going, when one is held. */
  to: string | null;
  /** Keep the page and cancel the held move. */
  stay: () => void;
  /** Let the held move through. */
  leave: () => void;
}

export type LeaveGuardHook = (options: LeaveGuardOptions) => LeaveGuard;

const idle = { blocked: false, to: null, stay: () => undefined, leave: () => undefined };

/** Without a shell router (tests, Storybook) only the tab's close and reload are guarded. */
const useBeforeUnloadOnly: LeaveGuardHook = ({ when }) => {
  useEffect(() => {
    if (!when) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [when]);
  return idle;
};

const LeaveGuardContext = createContext<LeaveGuardHook>(useBeforeUnloadOnly);

/** The shell wraps the app in this with its router's implementation; it must never change. */
export function LeaveGuardProvider({
  hook,
  children,
}: {
  hook: LeaveGuardHook;
  children: ReactNode;
}) {
  return <LeaveGuardContext.Provider value={hook}>{children}</LeaveGuardContext.Provider>;
}

/** Holds navigation away from the page while `when` is true. */
export function useLeaveGuard(options: LeaveGuardOptions): LeaveGuard {
  const useImplementation = useContext(LeaveGuardContext);
  return useImplementation(options);
}
