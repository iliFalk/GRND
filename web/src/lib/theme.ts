import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'arc';

function telegramWebApp(): TelegramWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.Telegram?.WebApp;
}

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'arc';
}

const THEME_KEY = 'grnd-theme';

/** The theme he picked himself, or `undefined` when he never picked one. */
function storedTheme(): Theme | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // A blocked storage must not stop the shell from choosing a theme.
  }
  return undefined;
}

/**
 * Ilja, 2026-11-19: a theme he picked stays the default until he picks another, whatever the client
 * reports. Without a choice Telegram decides, and the system setting comes last.
 */
function preferredTheme(): Theme {
  // ?theme=arc renders a theme directly: a headless render cannot press a segment it cannot reach
  // before the first paint, and the theme itself must be proved without a click.
  const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('theme');
  if (isTheme(asked)) return asked;

  const stored = storedTheme();
  if (stored) return stored;

  const scheme = telegramWebApp()?.colorScheme;
  if (scheme === 'light' || scheme === 'dark') return scheme;

  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
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

  // Only the attribute follows the theme; the stored choice is written by a toggle, so an app that
  // never saw him pick one keeps following Telegram.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const appTelegram = telegramWebApp();
    if (!appTelegram?.onEvent) return;

    const followTelegram = () => {
      if (storedTheme()) return; // His own pick stands against the client.
      const scheme = appTelegram.colorScheme;
      if (isTheme(scheme)) setTheme(scheme);
    };

    appTelegram.onEvent('themeChanged', followTelegram);
    return () => appTelegram.offEvent?.('themeChanged', followTelegram);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        // The attribute is what matters; persistence is a convenience.
      }
      return next;
    });
  }, []);

  return { theme, setTheme, toggleTheme };
}
