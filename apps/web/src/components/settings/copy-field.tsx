import { Button } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';

interface CopyFieldProps {
  /** Names the value and its button for assistive tech: "Endpoint", "Client configuration". */
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  /** A block of several lines (a configuration snippet) rather than one line. */
  multiline?: boolean;
}

/**
 * A value to copy into another tool: shown in full so it can be selected by hand where the
 * clipboard is blocked, with a Copy button that says when it worked.
 */
export function CopyField({ label, value, copied, onCopy, multiline }: CopyFieldProps) {
  return (
    <div
      className={`flex gap-2 rounded-control border border-line bg-sunken p-1.5 ${
        multiline ? 'flex-col items-stretch' : 'items-center'
      }`}
    >
      {multiline ? (
        <pre
          aria-label={label}
          className="m-0 overflow-x-auto px-2 py-1.5 font-mono text-12 leading-body text-tx select-all"
        >
          {value}
        </pre>
      ) : (
        <code
          aria-label={label}
          className="min-w-0 flex-1 truncate px-2 font-mono text-12 text-tx select-all"
        >
          {value}
        </code>
      )}
      <Button
        size="sm"
        variant="secondary"
        className={multiline ? 'self-end' : 'shrink-0'}
        icon={<Icon name={copied ? 'check' : 'copy'} />}
        aria-label={`Copy ${label.toLowerCase()}`}
        onClick={onCopy}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
