import { useCallback, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { FooterNav, type PageId } from './components/FooterNav';
import { Header } from './components/Header';
import { HistoryScreen } from './components/history/HistoryScreen';
import { PlanView } from './components/plan/PlanView';
import { WorkoutScreen } from './components/workout/WorkoutScreen';
import { formatWeekRange } from './lib/format';
import { invalidateBlock } from './lib/block';
import { invalidateHistory } from './lib/history';
import { useTrainingPlans } from './lib/plans';
import { useTheme } from './lib/theme';
import { usePillars } from './lib/pillars';
import { useIdentity } from './lib/user';

function PlanScreen() {
  const { data, loading, error, reload } = useTrainingPlans();
  return <PlanView plans={data} loading={loading} error={error} onRetry={reload} />;
}

function initialPage(): PageId {
  // ?page=history renders a tab directly: a headless render cannot press a bar item it never sees,
  // and the port measures one screen at a time.
  const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('page');
  const known: PageId[] = ['dashboard', 'plan', 'workout', 'history'];
  return asked && known.includes(asked as PageId) ? (asked as PageId) : 'dashboard';
}

/** The Mini App for the account the server named: every screen reads that account, no other. */
function MiniApp({ userId }: { userId: string }) {
  const [page, setPage] = useState<PageId>(initialPage);
  const { theme, setTheme } = useTheme();
  const { data, loading, error, reload } = usePillars(userId);
  const weekRange = data ? formatWeekRange(data.week_start, data.week_end) : null;

  // A saved workout changes the week, the history and the block, so all three are read again.
  const saved = useCallback(() => {
    invalidateHistory(userId);
    invalidateBlock(userId);
    reload();
  }, [reload, userId]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <Header weekRange={weekRange} theme={theme} onTheme={setTheme} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-28 pt-4">
        {page === 'dashboard' ? (
          <Dashboard userId={userId} data={data} loading={loading} error={error} onRetry={reload} />
        ) : page === 'plan' ? (
          <PlanScreen />
        ) : page === 'workout' ? (
          <WorkoutScreen userId={userId} onSaved={saved} />
        ) : (
          <HistoryScreen userId={userId} />
        )}
      </main>
      <FooterNav active={page} onChange={setPage} />
    </div>
  );
}

/** What the app says when it has no account to read. */
function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-28 pt-4">
        <div className="arc-panel">
          <div className="arc-empty">
            <p className="arc-h3">{title}</p>
            <p className="arc-empty__text">{text}</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const identity = useIdentity();

  if (identity.status === 'ready') return <MiniApp userId={identity.userId} />;
  if (identity.status === 'error') {
    return <Notice title="The app could not prove who it is" text={identity.error} />;
  }
  if (identity.status === 'outside-telegram') {
    return (
      <Notice
        title="Open this inside Telegram"
        text="The week is the one of the account Telegram signs in, and outside the client there is none to read."
      />
    );
  }
  return <Notice title="Checking who this is" text="Telegram is verifying the Mini App." />;
}
