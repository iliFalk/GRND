/**
 * A tapped input on a phone.
 *
 * The keyboard covers the bottom of the page, so a field near the bottom ends up behind it: bring the
 * field to the middle once the keyboard has finished moving. Selecting what is there means the first
 * keystroke replaces the old value — no selecting, no deleting.
 */
export function revealInput(input: HTMLInputElement | null): void {
  if (!input || typeof window === 'undefined') return;

  // The keyboard animates: ask again while it moves, so the field lands in the visible half.
  for (const delay of [60, 300, 600]) {
    window.setTimeout(() => {
      input.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, delay);
  }
}

export function selectAllOnFocus(event: { currentTarget: HTMLInputElement }): void {
  event.currentTarget.select();
}
