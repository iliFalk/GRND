export type PageId = 'dashboard' | 'plan' | 'workout' | 'history';

export const PAGE_LABELS: Record<PageId, string> = {
  dashboard: 'Dashboard',
  plan: 'Plan',
  workout: 'Workout',
  history: 'History'
};

/**
 * Ilja, 2026-11-19: history on the left, dashboard on the right, and the plan is not a tab — it is
 * a block on the workout screen. The bar is the system's element: items on the touch floor, the current
 * destination marked by aria-current and a rule, never by colour alone.
 */
const PAGES: PageId[] = ['history', 'workout', 'dashboard'];

interface FooterNavProps {
  active: PageId;
  onChange: (page: PageId) => void;
}

export function FooterNav({ active, onChange }: FooterNavProps) {
  return (
    <nav className="arc-bar app-footer" aria-label="Primary">
      {PAGES.map((page) => {
        const selected = page === active;
        return (
          <button
            key={page}
            type="button"
            className="arc-bar__item"
            onClick={() => onChange(page)}
            aria-current={selected ? 'page' : undefined}
          >
            {PAGE_LABELS[page]}
          </button>
        );
      })}
    </nav>
  );
}
