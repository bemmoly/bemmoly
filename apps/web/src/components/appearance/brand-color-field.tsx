import { Input } from '@bemmoly/ui';
import { useId } from 'react';
import { BRAND_CHOICES } from './brand-choices.ts';

interface BrandColorFieldProps {
  brand: string;
  hex: { text: string; error: string | null; onChange: (text: string) => void };
  onPick: (brand: string) => void;
}

/**
 * Brand color: the mock's six swatches (28px, a 2px gap ring on the chosen
 * one), the hex field with its 16px colour square, and the help line. The
 * swatches and the square paint the colour being chosen, which is the point.
 */
export function BrandColorField({ brand, hex, onPick }: BrandColorFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="font-medium">
        Brand color
      </span>
      <div className="flex items-center gap-2">
        <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex items-center gap-2">
          {BRAND_CHOICES.map((choice) => {
            const selected = choice === brand.toLowerCase();
            return (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={choice}
                onClick={() => onPick(choice)}
                className={`size-7 cursor-pointer rounded-full border-0 p-0 outline-offset-2 focus-visible:outline-2 ${
                  selected ? 'outline-2' : ''
                }`}
                style={{ background: choice, outlineColor: choice }}
              />
            );
          })}
        </div>
        <Input
          aria-label="Brand color hex"
          aria-invalid={hex.error ? true : undefined}
          aria-describedby={`${id}-help`}
          mono
          spellCheck={false}
          value={hex.text}
          onChange={(event) => hex.onChange(event.target.value)}
          wrapperClassName="ml-auto w-29"
          prefix={
            <span
              aria-hidden="true"
              className="size-4 shrink-0 rounded-xs"
              style={{ background: brand }}
            />
          }
        />
      </div>
      <span id={`${id}-help`} className={`text-12 ${hex.error ? 'text-danger' : 'text-tx5'}`}>
        {hex.error ??
          'Used for primary buttons, links, selection and your logo tile. We derive hover, tint and dark variants automatically.'}
      </span>
    </div>
  );
}
