import { THEMES } from '@bemmoly/ui/tokens';
import { isThemeChoice, useThemeStore } from '../store/theme.ts';

/** Development aid only; the real switcher lives in Settings › Appearance. */
export function ThemeSwitcher() {
  const choice = useThemeStore((state) => state.choice);
  const setChoice = useThemeStore((state) => state.setChoice);
  return (
    <label className="flex items-center gap-2 text-tx4">
      <span>Theme</span>
      <select
        aria-label="Theme preset"
        className="h-control rounded-control border border-br3 bg-bg2 px-2 text-tx"
        value={choice}
        onChange={(event) => {
          if (isThemeChoice(event.target.value)) setChoice(event.target.value);
        }}
      >
        <option value="system">System</option>
        {THEMES.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name} ({theme.mode})
          </option>
        ))}
      </select>
    </label>
  );
}
