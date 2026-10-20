import { CheckCircle, Database } from 'lucide-react';
import { useConnectionStore } from '@/stores/connection';
import { useProjectStore } from '@/stores/project';

export default function StatusBar() {
  const project = useProjectStore((state) => state.currentProject);
  const connections = useConnectionStore((state) => state.connections);
  const topicsByConnection = useConnectionStore((state) => state.topicsByConnection);
  const consumerGroupsByConnection = useConnectionStore((state) => state.consumerGroupsByConnection);

  const totalTopics = Object.values(topicsByConnection).reduce((sum, topics) => sum + topics.length, 0);
  const totalGroups = Object.values(consumerGroupsByConnection).reduce((sum, groups) => sum + groups.length, 0);

  return (
    <div className="flex h-7 items-center gap-4 border-t border-border bg-surface-soft px-4 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5">
        <CheckCircle className="h-3.5 w-3.5 text-[#39bf45]" />
        就绪
      </span>
      {project ? (
        <span className="inline-flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5" />
          {project.name}
        </span>
      ) : null}
      <span>{connections.length} 个连接</span>
      <span>{totalTopics} 个主题</span>
      <span>{totalGroups} 个消费者组</span>
      <div className="flex-1" />
    </div>
  );
}