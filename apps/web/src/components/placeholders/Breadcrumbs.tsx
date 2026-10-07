/** PLACEHOLDER for @bemmoly/ui Breadcrumbs: "Workspace settings / Appearance". */
export function Breadcrumbs({ items }: { items: readonly string[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-small text-tx4">
      {items.join(' / ')}
    </nav>
  );
}
