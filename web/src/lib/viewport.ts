/**
 * The keyboard on a phone shrinks the VISUAL viewport; the layout viewport never learns about it. A
 * page pinned to the frame therefore keeps its fields where they were, and a tapped field stays
 * behind the keyboard — scrolling to it cannot help, because the scroll container still believes it
 * is a full screen tall.
 *
 * So the height of what is actually visible goes into `--app-height`, which `#root` uses, and the
 * body carries `data-keyboard="open"` while the keyboard is up: the footer steps aside and the
 * content gets the whole visible area.
 */
export function trackVisualViewport(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  const viewport = window.visualViewport;

  const apply = () => {
    const height = viewport ? Math.round(viewport.height) : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${height}px`);

    // A keyboard takes a large bite; a browser bar takes a small one.
    const keyboardOpen = viewport ? viewport.height < window.innerHeight - 120 : false;
    document.body.dataset.keyboard = keyboardOpen ? 'open' : 'closed';
  };

  viewport?.addEventListener('resize', apply);
  viewport?.addEventListener('scroll', apply);
  window.addEventListener('orientationchange', apply);
  apply();

  return () => {
    viewport?.removeEventListener('resize', apply);
    viewport?.removeEventListener('scroll', apply);
    window.removeEventListener('orientationchange', apply);
  };
}
