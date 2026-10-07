import { forwardRef, type ButtonHTMLAttributes } from 'react';

/** PLACEHOLDER for @bemmoly/ui IconButton: the 32px inbox and theme buttons of the Home top bar. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string }
>(function IconButton({ label, className, type = 'button', ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={`relative grid size-8 cursor-pointer place-items-center rounded-control border-0 bg-transparent text-tx2 hover:bg-bg2 focus-visible:outline-2 focus-visible:outline-ac ${className ?? ''}`}
      {...rest}
    />
  );
});
