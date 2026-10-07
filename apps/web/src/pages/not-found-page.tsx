import { Link } from '@tanstack/react-router';

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-130 flex-col items-start gap-3 px-10 py-16">
      <p className="m-0 font-mono text-mono font-medium text-tx5">404</p>
      <h1 className="m-0 text-title font-semibold tracking-[-.015em] text-tx">
        There is nothing at this address
      </h1>
      <p className="m-0 leading-normal text-tx4">
        The page may have moved, or the module that owns it is switched off or not shared with you.
      </p>
      <Link to="/" className="font-medium">
        Go to your work
      </Link>
    </div>
  );
}
