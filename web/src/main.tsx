import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('The root element is missing from index.html');

// Inside Telegram the client waits for `ready` and gives the app the full height on `expand`.
// Outside Telegram the object is absent and both calls do nothing.
const telegram = window.Telegram?.WebApp;
telegram?.ready?.();
telegram?.expand?.();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
