import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface AuthState {
  /** Supabase auth user id for this device, once established. */
  userId: string | null;
  /** True while we're checking for / creating a session. */
  loading: boolean;
  error: string | null;
}

/**
 * Every device needs a stable identity before it can create or join a
 * lobby — this is how a player's seat survives a page refresh and how the
 * database tells "your own seat" apart from everyone else's. We use
 * Supabase's anonymous auth rather than requiring an account, since this is
 * a table-side companion app, not a service people log into.
 */
export function useAnonymousAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    userId: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function ensureSession() {
      const { data: existing } = await supabase.auth.getSession();

      if (existing.session?.user) {
        if (!cancelled) {
          setState({ userId: existing.session.user.id, loading: false, error: null });
        }
        return;
      }

      const { data, error } = await supabase.auth.signInAnonymously();

      if (cancelled) return;

      if (error || !data.user) {
        setState({
          userId: null,
          loading: false,
          error: error?.message ?? "could not start a session",
        });
        return;
      }

      setState({ userId: data.user.id, loading: false, error: null });
    }

    ensureSession();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
