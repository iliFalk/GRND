import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api';

/** The profile facts the volume needs: the body that moved during bodyweight work. */
export interface UserProfile {
  userId: string;
  bodyweight?: number;
}

export interface ProfileState {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

async function reasonFor(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object') {
      const record = body as { error?: unknown; details?: unknown };
      const message = typeof record.details === 'string' ? record.details : record.error;
      if (typeof message === 'string' && message.trim() !== '') return message.trim();
    }
  } catch {
    // The body was not JSON; the status line names the reason then.
  }
  return response.statusText || `status ${response.status}`;
}

/** The profile, and one writer for the weight beside it. A missing profile is not an error. */
export function useUserProfile(userId: string) {
  const [state, setState] = useState<ProfileState>({ profile: null, loading: true, error: null });

  const reload = useCallback(async () => {
    try {
      const response = await apiFetch(`/api/user-profile/${encodeURIComponent(userId)}`);
      if (response.status === 404) {
        setState({ profile: null, loading: false, error: null });
        return;
      }
      if (!response.ok) throw new Error(await reasonFor(response));
      const profile = (await response.json()) as UserProfile;
      setState({ profile, loading: false, error: null });
    } catch (cause: unknown) {
      setState({
        profile: null,
        loading: false,
        error: cause instanceof Error ? cause.message : String(cause)
      });
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveBodyweight = useCallback(
    async (kg: number) => {
      const response = await apiFetch(`/api/user-profile/${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, bodyweight: kg })
      });
      if (!response.ok) throw new Error(await reasonFor(response));

      setState((previous) => ({
        profile: { ...(previous.profile ?? { userId }), userId, bodyweight: kg },
        loading: false,
        error: null
      }));
    },
    [userId]
  );

  return { ...state, saveBodyweight, reload };
}
