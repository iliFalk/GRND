import { useCallback, useEffect, useState } from 'react';
import {
  getDashboardState,
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

  const reload = useCallback(() => {
    void loadDashboardData(userId).catch(() => {
      // The state carries the error; the view offers a retry.
    });
  }, [userId]);

  return { ...state, reload };
}
