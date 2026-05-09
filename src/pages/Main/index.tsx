import { useEffect } from 'react';
import { Layout, message } from 'antd';
import MenuBar from './MenuBar';
import Sidebar from './Sidebar';
import ContentArea from './ContentArea';
import StatusBar from './StatusBar';
import { useSidebarStore } from '../../stores/sidebar';
import { useProjectStore } from '../../stores/project';
import { useConnectionStore } from '../../stores/connection';
import * as connectionApi from '../../api/connection';
import { frontendLogger } from '../../utils/logger';

const { Header, Sider, Content, Footer } = Layout;

interface MainProps {
  onCloseProject: () => void;
}

export default function Main({ onCloseProject }: MainProps) {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);
  const currentProject = useProjectStore((s) => s.currentProject);
  const setConnections = useConnectionStore((s) => s.setConnections);

  useEffect(() => {
    let cancelled = false;

    async function loadConnections() {
      if (!currentProject) {
        setConnections([]);
        return;
      }

      frontendLogger.info('main', 'Loading project connections', {
        projectName: currentProject.name,
        projectPath: currentProject.path,
      });

      try {
        const connections = await connectionApi.getConnections();

        if (cancelled) {
          return;
        }

        setConnections(connections);
      } catch (error) {
        if (!cancelled) {
          frontendLogger.error('main', 'Failed to load project connections', error);
          message.error(`加载连接失败: ${error}`);
        }
      }
    }

    void loadConnections();

    return () => {
      cancelled = true;
    };
  }, [currentProject, setConnections]);

  return (
    <Layout style={{ height: '100%' }}>
      <Header
        style={{
          height: 32,
          lineHeight: '32px',
          padding: '0 8px',
          background: '#fff',
          borderBottom: '1px solid #d9d9d9',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <MenuBar onCloseProject={onCloseProject} />
      </Header>
      <Layout style={{ flex: 1, overflow: 'hidden' }}>
        <Sider
          width={240}
          collapsedWidth={36}
          collapsed={collapsed}
          onCollapse={toggle}
          collapsible
          trigger={null}
          style={{
            background: '#fff',
            borderRight: '1px solid #d9d9d9',
            overflow: 'auto',
          }}
        >
          <Sidebar collapsed={collapsed} onToggle={toggle} />
        </Sider>
        <Content style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ContentArea />
        </Content>
      </Layout>
      <Footer style={{ padding: 0, background: '#fafafa' }}>
        <StatusBar />
      </Footer>
    </Layout>
  );
}
