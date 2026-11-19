import { useCallback, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { FooterNav, type PageId } from './components/FooterNav';
import { Header } from './components/Header';
import { HistoryScreen } from './components/history/HistoryScreen';
import { PlanView } from './components/plan/PlanView';
import { WorkoutScreen } from './components/workout/WorkoutScreen';
import { formatWeekRange } from './lib/format';
import { invalidateHistory } from './lib/history';
import { useTrainingPlans } from './lib/plans';
import { useTheme } from './lib/theme';
import { usePillars } from './lib/pillars';
import { resolveUserId } from './lib/user';

function PlanScreen() {
  const { data, loading, error, reload } = useTrainingPlans();
  return <PlanView plans={data} loading={loading} error={error} onRetry={reload} />;
}

export default function App() {
  const [page, setPage] = useState<PageId>('dashboard');
  const { theme, toggleTheme } = useTheme();
  const userId = resolveUserId();
  const { data, loading, error, reload } = usePillars(userId);
  const weekRange = data ? formatWeekRange(data.week_start, data.week_end) : null;

  // A saved workout changes the week and the history, so both are read again.
  const saved = useCallback(() => {
    invalidateHistory(userId);
    reload();
  }, [reload, userId]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <Header weekRange={weekRange} theme={theme} onToggleTheme={toggleTheme} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-28 pt-5">
        {page === 'dashboard' ? (
          <Dashboard data={data} loading={loading} error={error} onRetry={reload} />
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
