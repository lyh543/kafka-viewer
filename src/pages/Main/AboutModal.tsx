import { Modal, Typography, Space } from 'antd';
import { GithubOutlined } from '@ant-design/icons';

const { Title, Text, Link } = Typography;

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AboutModal({ open, onClose }: AboutModalProps) {
  return (
    <Modal
      title="关于 Kafka Viewer"
      open={open}
      onCancel={onClose}
      footer={null}
      width={400}
    >
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <Title level={4} style={{ margin: 0 }}>
          Kafka Viewer
        </Title>
        <Text type="secondary">版本 0.1.0</Text>
        <br />
        <br />
        <Space direction="vertical" size={4}>
          <Text>一个现代化的 Kafka 桌面客户端</Text>
          <Text type="secondary">作者: lyh543</Text>
          <Link href="https://github.com/lyh543/kafka-viewer" target="_blank">
            <GithubOutlined /> GitHub
          </Link>
        </Space>
      </div>
    </Modal>
  );
}
