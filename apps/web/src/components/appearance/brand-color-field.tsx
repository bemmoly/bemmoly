import { Input } from '@bemmoly/ui';
import { useId } from 'react';

interface BrandColorFieldProps {
  brand: string;
  swatches: readonly string[];
  hex: { text: string; error: string | null; onChange: (text: string) => void };
  onPick: (brand: string) => void;
}

/**
 * Brand colour: the hex field with its colour square, then one-click swatches. The square and
 * the swatches paint the colour being chosen, which is the point, so they take it as style.
 */
export function BrandColorField({ brand, swatches, hex, onPick }: BrandColorFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="font-medium">
        Brand colour
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label="Brand colour hex"
          aria-invalid={hex.error ? true : undefined}
          aria-describedby={`${id}-help`}
          mono
          spellCheck={false}
          value={hex.text}
          onChange={(event) => hex.onChange(event.target.value)}
          wrapperClassName="w-50"
          prefix={
            <span
              aria-hidden="true"
              className="size-4 shrink-0 rounded-chip"
              style={{ background: brand }}
            />
          }
        />
        <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex items-center gap-2">
          {swatches.map((choice) => {
            const selected = choice === brand.toLowerCase();
            return (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={choice}
                onClick={() => onPick(choice)}
                className={`size-5.5 cursor-pointer rounded-full border-0 p-0 shadow-ring outline-offset-2 focus-visible:outline-2 ${
                  selected ? 'outline-2' : ''
                }`}
                style={{ background: choice, outlineColor: choice }}
              />
            );
          })}
        </div>
      </div>
      <span id={`${id}-help`} className={`text-12 ${hex.error ? 'text-red-tx' : 'text-tx-3'}`}>
        {hex.error ??
          'Used for links, primary buttons and selection, adjusted until each passes contrast. Never the logo.'}
      </span>
    </div>
  );
}
