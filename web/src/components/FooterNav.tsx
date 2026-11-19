import { cn } from '../lib/utils';

export type PageId = 'dashboard' | 'plan' | 'workout' | 'history';

export const PAGE_LABELS: Record<PageId, string> = {
  dashboard: 'Dashboard',
  plan: 'Plan',
  workout: 'Workout',
  history: 'History'
};

/**
 * Ilja, 2026-11-19: history on the left, dashboard on the right, and the plan is not a tab — it is
 * a block on the workout screen.
 */
const PAGES: PageId[] = ['history', 'workout', 'dashboard'];

interface FooterNavProps {
  active: PageId;
  onChange: (page: PageId) => void;
}

export function FooterNav({ active, onChange }: FooterNavProps) {
  return (
    <nav className="app-footer fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur">
      <div className="mx-auto grid w-full max-w-xl grid-cols-3 px-2 pb-[env(safe-area-inset-bottom)]">
        {PAGES.map((page) => {
          const selected = page === active;
          return (
            <button
              key={page}
              type="button"
              onClick={() => onChange(page)}
              aria-current={selected ? 'page' : undefined}
              className={cn(
                // A third larger than the four-tab bar it replaces.
                'flex flex-col items-center gap-1.5 rounded-control px-3 py-3.5 text-base font-medium uppercase tracking-wide transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span
                className={cn('h-2 w-2 rounded-pill', selected ? 'bg-primary' : 'bg-transparent')}
                aria-hidden="true"
              />
              {PAGE_LABELS[page]}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
