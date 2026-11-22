/**
 * Who the app is.
 *
 * The client's own unsigned parse proves nothing, the host page cannot name an account and there is
 * no default one: the id is read from `GET /api/me`, which takes it out of the signed `initData`
 * (AC29). Outside Telegram there is no identity, and the shell says so instead of reading an account.
 */
import { useEffect, useState } from 'react';
import { currentUserId, hasInitData, knownUserId } from './api';

export type IdentityState =
  | { status: 'outside-telegram' }
  | { status: 'loading' }
  | { status: 'ready'; userId: string }
  | { status: 'error'; error: string };

/** The id the server has named, once it has; `null` outside Telegram and before the first answer. */
export function resolveUserId(): string | null {
  if (!hasInitData()) return null;
  return knownUserId();
}

/** The identity the shell renders with: a signed string, then the id the server reads out of it. */
export function useIdentity(): IdentityState {
  const [state, setState] = useState<IdentityState>(() => {
    const userId = resolveUserId();
    if (userId !== null) return { status: 'ready', userId };
    return hasInitData() ? { status: 'loading' } : { status: 'outside-telegram' };
  });

  useEffect(() => {
    if (!hasInitData()) {
      setState({ status: 'outside-telegram' });
      return;
    }

    const known = knownUserId();
    if (known !== null) {
      setState({ status: 'ready', userId: known });
      return;
    }

    let active = true;
    currentUserId()
      .then((userId) => {
        if (active) setState({ status: 'ready', userId });
      })
      .catch((cause: unknown) => {
        if (active) {
          setState({ status: 'error', error: cause instanceof Error ? cause.message : String(cause) });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
