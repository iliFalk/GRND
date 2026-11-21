import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'arc';

function telegramWebApp(): TelegramWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.Telegram?.WebApp;
}

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'arc';
}

/** Telegram decides when it is there; a stored choice and the system setting come after it. */
function preferredTheme(): Theme {
  // ?theme=arc renders a theme directly: a headless render cannot press a segment it cannot reach
  // before the first paint, and the theme itself must be proved without a click.
  const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('theme');
  if (isTheme(asked)) return asked;

  const scheme = telegramWebApp()?.colorScheme;
  if (scheme === 'light' || scheme === 'dark') return scheme;

  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('grnd-theme');
      if (isTheme(stored)) return stored;
    } catch {
      // A blocked storage must not stop the shell from choosing a theme.
    }

    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  }

  return 'light';
}

export function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
    // The design system reads its own flag: without it the page renders ARC's tokens under the app's
    // ink, and a heading measures near-black on a near-black panel. The ARC theme is the dark scheme —
    // the system's dark pairing is the one the cyber grammar was measured on.
    document.documentElement.dataset.scheme = theme === 'arc' ? 'dark' : theme;
  }
}

export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(preferredTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem('grnd-theme', theme);
    } catch {
      // The attribute is what matters; persistence is a convenience.
    }
  }, [theme]);

  useEffect(() => {
    const appTelegram = telegramWebApp();
    if (!appTelegram?.onEvent) return;

    const followTelegram = () => {
      const scheme = appTelegram.colorScheme;
      if (scheme === 'light' || scheme === 'dark') setTheme(scheme);
    };

    appTelegram.onEvent('themeChanged', followTelegram);
    return () => appTelegram.offEvent?.('themeChanged', followTelegram);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, setTheme, toggleTheme };
}
