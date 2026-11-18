import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

function telegramWebApp(): TelegramWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.Telegram?.WebApp;
}

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** Telegram decides when it is there; a stored choice and the system setting come after it. */
function preferredTheme(): Theme {
  const scheme = telegramWebApp()?.colorScheme;
  if (isTheme(scheme)) return scheme;

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
  }
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
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
      if (isTheme(scheme)) setTheme(scheme);
    };

    appTelegram.onEvent('themeChanged', followTelegram);
    return () => appTelegram.offEvent?.('themeChanged', followTelegram);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
