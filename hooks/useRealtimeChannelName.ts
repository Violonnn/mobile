import { useId } from 'react';

/** Creates a stable, React-safe Supabase Realtime channel name per hook instance. */
export function useRealtimeChannelName(prefix: string): string {
  const reactInstanceId = useId();

  // Supabase channel topics are easier to inspect when React's colon separators are removed.
  const safeInstanceId = reactInstanceId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${prefix}-${safeInstanceId}`;
}
