import {
  CheckCircleOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useConnectionStore } from '../../stores/connection';
import { useProjectStore } from '../../stores/project';

export default function StatusBar() {
  const project = useProjectStore((s) => s.currentProject);
  const connections = useConnectionStore((s) => s.connections);
  const topicsByConnection = useConnectionStore((s) => s.topicsByConnection);
  const consumerGroupsByConnection = useConnectionStore((s) => s.consumerGroupsByConnection);

  const totalTopics = Object.values(topicsByConnection).reduce(
    (sum, t) => sum + t.length,
    0
  );
  const totalGroups = Object.values(consumerGroupsByConnection).reduce(
    (sum, g) => sum + g.length,
    0
  );

  return (
    <div className="status-bar">
      <span className="status-bar-item">
        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 10 }} />
        就绪
      </span>
      {project && (
        <span className="status-bar-item">
          <DatabaseOutlined style={{ fontSize: 10 }} />
          {project.name}
        </span>
      )}
      <span className="status-bar-item">
        {connections.length} 个连接
      </span>
      <span className="status-bar-item">
        {totalTopics} 个主题
      </span>
      <span className="status-bar-item">
        {totalGroups} 个消费者组
      </span>
      <div style={{ flex: 1 }} />
    </div>
  );
}
