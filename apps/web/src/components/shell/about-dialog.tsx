import { Button, Logo, Modal } from '@bemmoly/ui';
import { APP_VERSION, WHATS_NEW_URL } from '../../hooks/use-shell.ts';
import { useUiStore } from '../../store/ui.ts';

const LINKS = [
  { label: 'What’s new', href: WHATS_NEW_URL },
  { label: 'Documentation', href: 'https://bemmoly.com/docs' },
  { label: 'Source code', href: 'https://github.com/bemmoly/bemmoly' },
];

/** About Bemmoly, from the workspace menu: the version this install runs and where to read more. */
export function AboutDialog({ workspaceName }: { workspaceName: string }) {
  const open = useUiStore((state) => state.aboutOpen);
  const setOpen = useUiStore((state) => state.setAboutOpen);
  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="About Bemmoly"
      width="sm"
      footer={
        <Button variant="primary" onClick={() => setOpen(false)}>
          Done
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-3 px-4 pt-6 pb-5 text-center">
        <Logo variant="lockup" size={32} />
        <p className="m-0 text-13 text-tx-2">
          Version <span className="font-mono text-tx">{APP_VERSION}</span>, running {workspaceName}.
          <br />
          Open source under the MIT licence: your work, your platform.
        </p>
        <nav
          aria-label="About links"
          className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-13"
        >
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noopener">
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </Modal>
  );
}
