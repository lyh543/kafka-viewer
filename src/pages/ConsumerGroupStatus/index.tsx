import { Users } from 'lucide-react';

interface ConsumerGroupStatusProps {
  connectionId: string;
  connectionName: string;
  groupId: string;
}

export default function ConsumerGroupStatus({
  connectionId,
  connectionName,
  groupId,
}: ConsumerGroupStatusProps) {
  return (
    <section className="space-y-6">
      <div className="rounded-[12px] bg-signature-mint/35 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-foreground">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Consumer Group</p>
            <h2 className="mt-2 text-2xl font-medium text-foreground">{groupId}</h2>
            <p className="mt-2 text-sm leading-6 text-body">
              当前连接: {connectionName} · {connectionId}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[12px] border border-dashed border-border-strong bg-white px-6 py-10 text-sm leading-6 text-body">
        消费者组状态页将在下一轮接入 members / offsets 表格与 lag 状态展示。当前双击打开与 tab 切换链路已恢复。
      </div>
    </section>
  );
}