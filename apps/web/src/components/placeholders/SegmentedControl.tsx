/** PLACEHOLDER for @bemmoly/ui SegmentedControl: "Light | Dark" and "Board | Doc | Login". */
export interface SegmentedControlProps<V extends string> {
  value: V;
  onChange: (value: V) => void;
  options: ReadonlyArray<{ value: V; label: string }>;
  label: string;
  size?: 'md' | 'sm';
}

export function SegmentedControl<V extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
}: SegmentedControlProps<V>) {
  const item =
    size === 'md' ? 'flex-1 py-1.5 rounded-small' : 'px-2.25 py-0.75 rounded-tag text-caption';
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-control bg-chip p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`cursor-pointer border-0 text-center font-sans font-medium ${item} ${
              active ? 'bg-sf text-tx shadow-segment' : 'bg-transparent text-tx4'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
