import { Notice } from '../form.tsx';

/** The server's own words while a restore, update or rollback holds writes. */
export function MaintenanceNotice({ active, message }: { active: boolean; message: string }) {
  if (!active) return null;
  return (
    <div role="status">
      <Notice tone="caution">
        {message} Changes are paused until it finishes; this page keeps checking.
      </Notice>
    </div>
  );
}
