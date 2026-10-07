/** PLACEHOLDER for @bemmoly/ui Switch: 34×20 in settings rows, 30×18 for matrix locks. */
export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  size?: 'md' | 'sm';
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, size = 'md', disabled }: SwitchProps) {
  const track = size === 'md' ? 'h-5 w-8.5 rounded-[10px]' : 'h-4.5 w-7.5 rounded-[9px]';
  const knob = size === 'md' ? 'size-4' : 'size-3.5';
  const travel = size === 'md' ? 'translate-x-3.5' : 'translate-x-3';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 cursor-pointer border-0 p-0.5 ${track} ${
        checked ? 'bg-ac' : 'bg-switch-off'
      } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span
        className={`block rounded-full bg-on-ac transition-transform duration-150 ${knob} ${
          checked ? travel : 'translate-x-0'
        }`}
      />
    </button>
  );
}
