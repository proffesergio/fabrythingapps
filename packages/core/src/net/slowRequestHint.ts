import { useEffect, useState } from 'react';

// The API host is Render's free tier, which sleeps when idle -- the first
// request after a nap can take ~30s to come back while the dyno wakes up.
// A screen that just spins for 30s with nothing said looks broken, and
// bailing out with an error before that window elapses is worse (a
// perfectly fine request looks like a failure). So a loading screen calls
// this with its `loading` flag and, once `loading` has been true for
// `delayMs`, gets back `true` and can show a "this is taking a little
// longer than usual" hint alongside the spinner instead of either extreme.
export const SLOW_REQUEST_HINT_MS = 4000;

export function useSlowRequestHint(loading: boolean, delayMs: number = SLOW_REQUEST_HINT_MS): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const id = setTimeout(() => setSlow(true), delayMs);
    return () => clearTimeout(id);
  }, [loading, delayMs]);

  return slow;
}
