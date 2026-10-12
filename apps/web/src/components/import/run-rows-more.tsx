import { Button } from '@bemmoly/ui';
import { count } from './import-words.ts';

interface RunRowsMoreProps {
  /** Rows the server holds beyond those read so far. */
  left: number;
  loading: boolean;
  onMore: () => void;
}

/** Reads the next page of a long run's rows, once the first page is open. */
export function RunRowsMore({ left, loading, onMore }: RunRowsMoreProps) {
  if (left <= 0) return null;
  return (
    <Button size="sm" variant="ghost" className="self-start" loading={loading} onClick={onMore}>
      {`Show ${count(left)} more`}
    </Button>
  );
}
