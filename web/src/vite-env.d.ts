/// <reference types="vite/client" />

interface TelegramWebAppUser {
  id?: number | string;
  first_name?: string;
  username?: string;
}

interface TelegramWebApp {
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
  };
  colorScheme?: 'light' | 'dark' | string;
  onEvent?: (event: string, callback: () => void) => void;
  offEvent?: (event: string, callback: () => void) => void;
  ready?: () => void;
  expand?: () => void;
  disableVerticalSwipes?: () => void;
  isVerticalSwipesEnabled?: boolean;
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
  __GRND_USER_ID__?: string | number;
}
