import { useCallback, useEffect, useState } from 'react';
import { readTheme, writeTheme } from './persistence';

export type Theme = 'light' | 'dark' | 'arc';

function telegramWebApp(): TelegramWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.Telegram?.WebApp;
}

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'arc';
}

/** The theme he picked himself, or `undefined` when he never picked one. */
function storedTheme(): Theme | undefined {
  const stored = readTheme();
  return isTheme(stored) ? stored : undefined;
}

/** Written on every explicit choice — a chip, a toggle — never by the client's own event. */
function storeTheme(theme: Theme): void {
  writeTheme(theme);
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

/**
 * The colour of the page itself, resolved: an ARC token reads `var(--arc-bg-base)` out of the custom
 * property, so the used background colour of `body` is the only reliable answer.
 */
function backgroundHex(): string | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;

  const rgb = window.getComputedStyle(document.body).backgroundColor;
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;

  const hex = (value: string) => Number(value).toString(16).padStart(2, '0');
  return `#${hex(match[1])}${hex(match[2])}${hex(match[3])}`;
}

/**
 * The service bar above the page is drawn by Telegram, not by CSS. Ilja, 2026-11-21: it should carry
 * the theme's own colour, so the app and its chrome read as one surface.
 */
function paintServiceBar(): void {
  const app = telegramWebApp();
  if (!app?.setHeaderColor) return;

  const colour = backgroundHex();
  if (!colour) return;

  app.setHeaderColor(colour);
  app.setBottomBarColor?.(colour);
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
  const [theme, setThemeState] = useState<Theme>(preferredTheme);

  // Only the attribute follows the theme here; the choice is stored by the setters below, so an app
  // that never saw him pick one keeps following Telegram.
  useEffect(() => {
    applyTheme(theme);
    paintServiceBar();
  }, [theme]);

  useEffect(() => {
    const appTelegram = telegramWebApp();
    if (!appTelegram?.onEvent) return;

    const followTelegram = () => {
      if (storedTheme()) return; // His own pick stands against the client.
      const scheme = appTelegram.colorScheme;
      if (isTheme(scheme)) setThemeState(scheme);
    };

    appTelegram.onEvent('themeChanged', followTelegram);
    return () => appTelegram.offEvent?.('themeChanged', followTelegram);
  }, []);

  /**
   * Ilja, 2026-11-21: the chips are what he presses, so the write belongs here. Storing only in the
   * toggle meant the choice was never written at all.
   */
  const setTheme = useCallback((next: Theme) => {
    storeTheme(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      storeTheme(next);
      return next;
    });
  }, []);

  return { theme, setTheme, toggleTheme };
}
