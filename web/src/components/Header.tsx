import type { Theme } from '../lib/theme';

interface HeaderProps {
  weekRange: string | null;
  theme: Theme;
  onTheme: (theme: Theme) => void;
}

const THEMES: { id: Theme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'arc', label: 'ARC' }
];

export function Header({ weekRange, theme, onTheme }: HeaderProps) {
  return (
    <header className="arc-appbar app-bar">
      <p className="arc-micro">{weekRange ?? 'This week'}</p>
      <div className="arc-appbar__row">
        <p className="arc-h2">GRND</p>
        <div role="group" aria-label="Theme" className="flex shrink-0 gap-1">
          {THEMES.map(({ id, label }) => {
            const active = theme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTheme(id)}
                aria-pressed={active}
                className={active ? 'arc-chip arc-chip--selected' : 'arc-chip'}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
