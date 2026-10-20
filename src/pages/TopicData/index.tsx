import { TableProperties } from 'lucide-react';

interface TopicDataProps {
  connectionId: string;
  connectionName: string;
  topicName: string;
}

export default function TopicData({ connectionId, connectionName, topicName }: TopicDataProps) {
  return (
    <section className="space-y-6">
      <div className="rounded-[12px] bg-signature-peach/35 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-foreground">
            <TableProperties className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Topic Data</p>
            <h2 className="mt-2 text-2xl font-medium text-foreground">{topicName}</h2>
            <p className="mt-2 text-sm leading-6 text-body">
              当前连接: {connectionName} · {connectionId}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[12px] border border-dashed border-border-strong bg-white px-6 py-10 text-sm leading-6 text-body">
        Topic 数据页会在下一轮接入过滤器、消息表格和生产消息对话框。现在已经可以通过右键菜单把它加入 tab 栏。
      </div>
    </section>
  );
}