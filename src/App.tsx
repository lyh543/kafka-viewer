import { useState } from 'react';
import { ConfigProvider, theme, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Welcome from './pages/Welcome';
import Main from './pages/Main';
import './styles/global.css';

export default function App() {
  const [projectOpen, setProjectOpen] = useState(false);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.compactAlgorithm,
        token: {
          motion: false,
        },
      }}
    >
      <AntApp style={{ height: '100%' }}>
        {projectOpen ? (
          <Main onCloseProject={() => setProjectOpen(false)} />
        ) : (
          <Welcome onProjectOpened={() => setProjectOpen(true)} />
        )}
      </AntApp>
    </ConfigProvider>
  );
}
