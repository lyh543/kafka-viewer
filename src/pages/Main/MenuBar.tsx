import { useState } from 'react';
import { Dropdown, Space, type MenuProps } from 'antd';
import {
  FileOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import ConnectionModal from '../ConnectionModal';
import AboutModal from './AboutModal';

interface MenuBarProps {
  onCloseProject: () => void;
}

export default function MenuBar({ onCloseProject }: MenuBarProps) {
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);

  const fileMenuItems: MenuProps['items'] = [
    { key: 'manage-connections', label: '管理连接', onClick: () => setConnectionModalOpen(true) },
    { type: 'divider' },
    { key: 'close-project', label: '关闭项目', onClick: onCloseProject },
  ];

  const helpMenuItems: MenuProps['items'] = [
    { key: 'check-update', label: '检查更新', onClick: () => { /* TODO */ } },
    { type: 'divider' },
    { key: 'about', label: '关于', onClick: () => setAboutModalOpen(true) },
  ];

  return (
    <>
      <Space size={0}>
        <Dropdown menu={{ items: fileMenuItems }} trigger={['click']}>
          <div
            style={{
              padding: '0 12px',
              cursor: 'pointer',
              fontSize: 13,
              height: 32,
              lineHeight: '32px',
            }}
          >
            <FileOutlined style={{ marginRight: 4 }} />
            文件
          </div>
        </Dropdown>
        <Dropdown menu={{ items: helpMenuItems }} trigger={['click']}>
          <div
            style={{
              padding: '0 12px',
              cursor: 'pointer',
              fontSize: 13,
              height: 32,
              lineHeight: '32px',
            }}
          >
            <QuestionCircleOutlined style={{ marginRight: 4 }} />
            帮助
          </div>
        </Dropdown>
      </Space>

      <ConnectionModal
        open={connectionModalOpen}
        onClose={() => setConnectionModalOpen(false)}
      />
      <AboutModal open={aboutModalOpen} onClose={() => setAboutModalOpen(false)} />
    </>
  );
}
