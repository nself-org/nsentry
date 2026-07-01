/**
 * Purpose: Minimal typed async data hook — loading/error/data + refresh, used
 *          by all list/detail screens against NsentryClient methods.
 * Inputs: an async producer (stable via deps array).
 * Outputs: { data, loading, error, refresh }.
 * Constraints: cancels state updates after unmount; no cache (screens are
 *   lightweight; pull-to-refresh re-fetches). Replace with TanStack Query if
 *   the app grows offline caching needs.
 */
import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

export interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useFetch<T>(producer: () => Promise<T>, deps: DependencyList): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await producer();
      if (mountedRef.current) setData(result);
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // deps intentionally caller-provided (mirrors useCallback semantics)
  }, deps);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refresh: load };
}
