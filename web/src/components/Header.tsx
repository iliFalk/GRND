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
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-xl font-black tracking-[0.18em] text-foreground">GRND</h1>
          <p className="truncate text-xs text-muted-foreground">{weekRange ?? 'This week'}</p>
        </div>
        {/* One segment per theme, each on the touch floor; the chosen one is filled, so the state is not
            carried by colour alone. */}
        <div role="group" aria-label="Theme" className="flex shrink-0 border border-border">
          {THEMES.map(({ id, label }) => {
            const active = theme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTheme(id)}
                aria-pressed={active}
                className={`min-h-11 min-w-11 px-2 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
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
