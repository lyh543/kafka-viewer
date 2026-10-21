import { useEffect, useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useLogStore } from '@/stores/log';

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

const isProblemLine = (line: string) => /\b(ERROR|WARN)\b/i.test(line);

export default function LogDialog() {
  const isOpen = useLogStore((state) => state.isOpen);
  const lines = useLogStore((state) => state.lines);
  const loading = useLogStore((state) => state.loading);
  const error = useLogStore((state) => state.error);
  const close = useLogStore((state) => state.close);
  const reload = useLogStore((state) => state.reload);
  const [onlyProblems, setOnlyProblems] = useState(false);

  useEffect(() => {
    if (isOpen) {
      void reload();
    }
  }, [isOpen, reload]);

  const cleanedLines = useMemo(
    () => lines.map((line) => line.replace(ANSI_PATTERN, '')),
    [lines]
  );

  const visibleLines = onlyProblems ? cleanedLines.filter(isProblemLine) : cleanedLines;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(visibleLines.join('\n'));
      toast.success('日志已复制');
    } catch (copyError) {
      toast.error(`复制失败: ${String(copyError)}`);
    }
  };

  return (
    <Dialog onOpenChange={(open) => (open ? void reload() : close())} open={isOpen}>
      <DialogContent className="w-[min(96vw,64rem)]">
        <DialogHeader>
          <DialogTitle>运行日志</DialogTitle>
          <DialogDescription>
            最近的 {visibleLines.length} 条前端与后端日志。出现网络异常时可从这里查看详情。
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-body">
            <Switch checked={onlyProblems} onCheckedChange={setOnlyProblems} />
            仅显示 WARN / ERROR
          </label>
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={() => void reload()} size="sm" variant="outline">
              刷新
            </Button>
            <Button onClick={() => void handleCopy()} size="sm" variant="outline">
              <Copy className="h-3.5 w-3.5" />
              复制
            </Button>
          </div>
        </div>

        <div className="mt-3 h-[60vh] overflow-auto rounded-[10px] border border-border bg-surface-soft p-3">
          {loading ? (
            <p className="text-xs text-muted">正在读取日志...</p>
          ) : error ? (
            <p className="text-xs text-signature-coral">读取日志失败: {error}</p>
          ) : visibleLines.length === 0 ? (
            <p className="text-xs text-muted">暂无日志</p>
          ) : (
            <pre className="whitespace-pre-wrap break-all text-[11px] leading-5 text-body">
              {visibleLines.map((line, index) => (
                <div
                  className={isProblemLine(line) ? 'text-signature-coral' : undefined}
                  key={`${index}-${line.slice(0, 24)}`}
                >
                  {line}
                </div>
              ))}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
