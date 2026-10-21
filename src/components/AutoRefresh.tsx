import { useEffect, useState } from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { REFRESH_OPTIONS, type RefreshInterval } from '@/hooks/useAutoRefresh';
import { cn } from '@/lib/utils';

const selectClass =
  'h-7 rounded-[6px] border border-border bg-white px-2 text-xs text-foreground outline-none focus-visible:border-[color:var(--ring)]';

interface RefreshButtonProps {
  loading: boolean;
  onRefresh: () => void;
}

export function RefreshButton({ loading, onRefresh }: RefreshButtonProps) {
  return (
    <Button onClick={onRefresh} size="sm" variant="outline">
      {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
      刷新
    </Button>
  );
}

/** Formats a timestamp as a human-friendly relative time, e.g. "12秒前". */
export function formatRelativeTime(date: Date, now: number): string {
  const diffSeconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));

  if (diffSeconds < 5) {
    return '刚刚';
  }

  if (diffSeconds < 60) {
    return `${diffSeconds}秒前`;
  }

  const minutes = Math.floor(diffSeconds / 60);

  if (minutes < 60) {
    return `${minutes}分钟前`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}小时前`;
  }

  return date.toLocaleDateString();
}

function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [enabled]);

  return now;
}

interface AutoRefreshControlsProps {
  enabled: boolean;
  intervalSecs: RefreshInterval;
  lastRefreshed?: Date | null;
  onEnabledChange: (enabled: boolean) => void;
  onIntervalChange: (interval: RefreshInterval) => void;
  className?: string;
  children?: React.ReactNode;
}

export function AutoRefreshControls({
  enabled,
  intervalSecs,
  lastRefreshed,
  onEnabledChange,
  onIntervalChange,
  className,
  children,
}: AutoRefreshControlsProps) {
  const now = useNow(Boolean(lastRefreshed));

  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-xs text-body', className)}>
      <label className="inline-flex items-center gap-1.5">
        <span>自动刷新</span>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </label>

      {enabled ? (
        <select
          className={selectClass}
          onChange={(event) => onIntervalChange(Number(event.target.value) as RefreshInterval)}
          value={intervalSecs}
        >
          {REFRESH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      {lastRefreshed ? (
        <span className="text-muted" title={lastRefreshed.toLocaleString()}>
          {formatRelativeTime(lastRefreshed, now)}
        </span>
      ) : null}

      {children}
    </div>
  );
}
