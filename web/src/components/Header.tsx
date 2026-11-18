import { Button } from './ui/button';
import type { Theme } from '../lib/theme';

interface HeaderProps {
  weekRange: string | null;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Header({ weekRange, theme, onToggleTheme }: HeaderProps) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-xl font-black tracking-[0.18em] text-foreground">GRND</h1>
          <p className="truncate text-xs text-muted-foreground">{weekRange ?? 'This week'}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleTheme}
          aria-label={`Switch to ${nextTheme} theme`}
          aria-pressed={theme === 'dark'}
        >
          <span className="h-2 w-2 rounded-pill bg-primary" aria-hidden="true" />
          {nextTheme === 'dark' ? 'Dark' : 'Light'}
        </Button>
      </div>
    </header>
  );
}
