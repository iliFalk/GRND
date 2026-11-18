import { cn } from '../lib/utils';

export type PageId = 'dashboard' | 'plan' | 'workout' | 'history';

export const PAGE_LABELS: Record<PageId, string> = {
  dashboard: 'Dashboard',
  plan: 'Plan',
  workout: 'Workout',
  history: 'History'
};

const PAGES: PageId[] = ['dashboard', 'plan', 'workout', 'history'];

interface FooterNavProps {
  active: PageId;
  onChange: (page: PageId) => void;
}

export function FooterNav({ active, onChange }: FooterNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur">
      <div className="mx-auto grid w-full max-w-xl grid-cols-4 px-2 pb-[env(safe-area-inset-bottom)]">
        {PAGES.map((page) => {
          const selected = page === active;
          return (
            <button
              key={page}
              type="button"
              onClick={() => onChange(page)}
              aria-current={selected ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center gap-1 rounded-control px-2 py-2.5 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span
                className={cn('h-1.5 w-1.5 rounded-pill', selected ? 'bg-primary' : 'bg-transparent')}
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
