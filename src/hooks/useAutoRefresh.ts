import { useEffect, useRef, useCallback, useState } from 'react';

export type RefreshInterval = 5 | 10 | 30 | 60 | 120 | 300;

export const REFRESH_OPTIONS: { label: string; value: RefreshInterval }[] = [
  { label: '5秒', value: 5 },
  { label: '10秒', value: 10 },
  { label: '30秒', value: 30 },
  { label: '1分钟', value: 60 },
  { label: '2分钟', value: 120 },
  { label: '5分钟', value: 300 },
];

interface UseAutoRefreshOptions {
  enabled: boolean;
  intervalSecs: RefreshInterval;
}

export function useAutoRefresh(
  fetchFn: () => Promise<void>,
  options: UseAutoRefreshOptions
) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const doRefresh = useCallback(async () => {
    setLoading(true);
    try {
      await fetchFn();
      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (options.enabled) {
      timerRef.current = setInterval(doRefresh, options.intervalSecs * 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [options.enabled, options.intervalSecs, doRefresh]);

  return { loading, lastRefreshed, refresh: doRefresh };
}
