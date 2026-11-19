import { useCallback, useEffect, useState } from 'react';
import {
  getDashboardState,
  invalidateDashboard,
  loadDashboardData,
  subscribeDashboard,
  type DashboardState
} from './suggestions';

export interface DashboardQuery extends DashboardState {
  reload: () => void;
}

export function useDashboardData(userId: string): DashboardQuery {
  const [state, setState] = useState<DashboardState>(() => getDashboardState(userId));

  useEffect(() => {
    let active = true;
    const sync = () => {
      if (active) setState(getDashboardState(userId));
    };

    const unsubscribe = subscribeDashboard(sync);
    sync();
    void loadDashboardData(userId).catch(() => {
      // The state carries the error; the view offers a retry.
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  // A reload asks the server again: a saved workout must reach the week it changed.
  const reload = useCallback(() => {
    invalidateDashboard(userId);
    void loadDashboardData(userId).catch(() => {
      // The state carries the error; the view offers a retry.
    });
  }, [userId]);

  return { ...state, reload };
}
