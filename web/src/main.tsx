import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { trackVisualViewport } from './lib/viewport';
import './styles/tokens.css';
import './styles/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('The root element is missing from index.html');

// Inside Telegram the client waits for `ready` and gives the app the full height on `expand`.
// `disableVerticalSwipes` keeps the sheet where it is: the app closes with its own button, never
// by dragging it down. Outside Telegram the object is absent and the calls do nothing.
trackVisualViewport();

const telegram = window.Telegram?.WebApp;
telegram?.ready?.();
telegram?.expand?.();
telegram?.disableVerticalSwipes?.();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
