import { SPACE_TONES, SpaceTile, type SpaceTone } from '@bemmoly/ui';

const TONE_NAMES: Record<SpaceTone, string> = {
  accent: 'Blue',
  violet: 'Violet',
  green: 'Green',
  orange: 'Orange',
  red: 'Red',
  amber: 'Amber',
  slate: 'Slate',
};

export interface SpaceTonePickerProps {
  name: string;
  spaceKey: string;
  value: SpaceTone;
  onChange: (tone: SpaceTone) => void;
}

/** The space colour as a row of tiles, each showing the space as it would look in that tone. */
export function SpaceTonePicker({ name, spaceKey, value, onChange }: SpaceTonePickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span id="space-colour" className="font-medium text-tx">
        Colour
      </span>
      <div role="radiogroup" aria-labelledby="space-colour" className="flex gap-2">
        {SPACE_TONES.map((tone) => (
          <button
            key={tone}
            type="button"
            role="radio"
            aria-checked={value === tone}
            aria-label={TONE_NAMES[tone]}
            onClick={() => onChange(tone)}
            className={`cursor-pointer rounded-card border-0 bg-transparent p-0.5 outline-offset-1 focus-ring ${
              value === tone ? 'shadow-ring-ac' : 'hover:shadow-ring'
            }`}
          >
            <SpaceTile name={name} {...(spaceKey ? { spaceKey } : {})} tone={tone} size="sm" />
          </button>
        ))}
      </div>
    </div>
  );
}
