import { useNavigate, useSearch } from '@tanstack/react-router';

/**
 * One value in the address (an open dialog, the open prompt), so reload and Back keep it.
 * Settings routes take any search, so this reads it loosely and writes it beside the rest.
 */
export function useSearchParam(name: string) {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const raw = search[name];
  const value = raw === undefined || raw === null || raw === '' ? null : String(raw);
  const set = (next: string | null, replace = false) =>
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => {
        const rest = { ...previous };
        delete rest[name];
        return next === null ? rest : { ...rest, [name]: next };
      },
      replace,
    } as never);
  return [value, set] as const;
}
