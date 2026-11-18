/**
 * The Telegram user when the Mini App supplies one. Outside Telegram the host page may inject
 * `window.__GRND_USER_ID__`; without either, the shell speaks for the default user.
 */
export function resolveUserId(): string {
  if (typeof window === 'undefined') return 'default-user';

  const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  if (telegramId !== undefined && telegramId !== null && String(telegramId).trim() !== '') {
    return String(telegramId);
  }

  const injectedId = window.__GRND_USER_ID__;
  if (injectedId !== undefined && injectedId !== null && String(injectedId).trim() !== '') {
    return String(injectedId);
  }

  return 'default-user';
}
