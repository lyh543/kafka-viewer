import { Layout } from 'antd';
import MenuBar from './MenuBar';
import Sidebar from './Sidebar';
import ContentArea from './ContentArea';
import StatusBar from './StatusBar';
import { useSidebarStore } from '../../stores/sidebar';

const { Header, Sider, Content, Footer } = Layout;

interface MainProps {
  onCloseProject: () => void;
}

export default function Main({ onCloseProject }: MainProps) {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);

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
