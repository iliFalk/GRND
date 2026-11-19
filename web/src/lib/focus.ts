/**
 * A tapped input on a phone.
 *
 * The keyboard covers the bottom of the page, so a field near the bottom ends up behind it: bring the
 * field to the middle once the keyboard has finished moving. Selecting what is there means the first
 * keystroke replaces the old value — no selecting, no deleting.
 */
export function revealInput(input: HTMLInputElement | null): void {
  if (!input || typeof window === 'undefined') return;
  window.setTimeout(() => {
    input.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 300);
}

export function selectAllOnFocus(event: { currentTarget: HTMLInputElement }): void {
  event.currentTarget.select();
}
