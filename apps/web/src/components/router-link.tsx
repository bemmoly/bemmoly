import { Link } from '@tanstack/react-router';
import type { AnchorHTMLAttributes, Ref } from 'react';

/**
 * The design system renders links through `linkAs` with an `href`; the router
 * navigates by `to`. This adapter is what the shell passes as `linkAs`.
 */
export function RouterLink({
  href,
  ref,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { ref?: Ref<HTMLAnchorElement> }) {
  return <Link to={href ?? '/'} ref={ref} {...rest} />;
}
