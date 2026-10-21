import { LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { REFRESH_OPTIONS, type RefreshInterval } from '@/hooks/useAutoRefresh';
import { cn } from '@/lib/utils';

const selectClass =
  'h-9 rounded-[10px] border border-border bg-white px-3 text-sm text-foreground outline-none focus-visible:border-[color:var(--ring)]';

interface RefreshButtonProps {
  loading: boolean;
  onRefresh: () => void;
}

export function RefreshButton({ loading, onRefresh }: RefreshButtonProps) {
  return (
    <Button onClick={onRefresh} size="sm" variant="outline">
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      刷新
    </Button>
  );
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
  return (
    <div className={cn('flex flex-wrap items-center gap-3 text-sm text-body', className)}>
      <label className="inline-flex items-center gap-2">
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

      {lastRefreshed ? <span className="text-muted">上次刷新: {lastRefreshed.toLocaleTimeString()}</span> : null}

      {children}
    </div>
  );
}
