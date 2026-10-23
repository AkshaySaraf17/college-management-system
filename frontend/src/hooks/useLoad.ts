import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage, unwrap } from "../api/client";

/** Loads GET `path` (skipped while path is null) and exposes {data, loading, error, reload}. */
export function useGet<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (path === null) {
      setData(null);
      setLoading(false);
      return;
    }
    const ticket = ++latest.current;
    setLoading(true);
    try {
      const result = await unwrap<T>(api.get(path));
      if (ticket === latest.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (ticket === latest.current) setError(errorMessage(err));
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}

/** Wraps a mutation: runs it, reports success/failure as a notice, and runs a follow-up (usually a reload). */
export function useNotice() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async <R,>(action: () => Promise<R>, successMessage?: string, after?: (result: R) => void | Promise<void>) => {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const result = await action();
      if (successMessage) setSuccess(successMessage);
      if (after) await after(result);
      return (result === undefined ? true : result) as R | true;
    } catch (err) {
      setError(errorMessage(err));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  const clear = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  return { error, success, busy, run, clear, setError, setSuccess };
}
