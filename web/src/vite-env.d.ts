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
  /** Colours the header Telegram draws above the page: 'bg_color', 'secondary_bg_color' or a hex. */
  setHeaderColor?: (color: string) => void;
  /** Colours the bar Telegram draws below the page (Bot API 7.10+). */
  setBottomBarColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
  __GRND_USER_ID__?: string | number;
}
