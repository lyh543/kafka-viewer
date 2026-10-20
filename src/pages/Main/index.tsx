import { useEffect } from 'react';
import { toast } from 'sonner';
import * as connectionApi from '@/api/connection';
import { useConnectionStore } from '@/stores/connection';
import { useProjectStore } from '@/stores/project';
import { useSidebarStore } from '@/stores/sidebar';
import { frontendLogger } from '@/utils/logger';
import ContentArea from './ContentArea';
import MenuBar from './MenuBar';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';

type MainProps = {
  onCloseProject: () => void;
};

export default function Main({ onCloseProject }: MainProps) {
  const collapsed = useSidebarStore((state) => state.collapsed);
  const toggle = useSidebarStore((state) => state.toggle);
  const currentProject = useProjectStore((state) => state.currentProject);
  const setConnections = useConnectionStore((state) => state.setConnections);

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
          toast.error(`加载连接失败: ${String(error)}`);
        }
      }
    }

    void loadConnections();

    return () => {
      cancelled = true;
    };
  }, [currentProject, setConnections]);

  return (
    <div className="flex h-full flex-col bg-canvas text-foreground">
      <header className="flex h-10 items-center border-b border-border bg-white px-2">
        <MenuBar onCloseProject={onCloseProject} />
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className={collapsed ? 'w-12 shrink-0 border-r border-border bg-white' : 'w-64 shrink-0 border-r border-border bg-white'}>
          <Sidebar collapsed={collapsed} onToggle={toggle} />
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden">
          <ContentArea />
        </main>
      </div>

      <footer>
        <StatusBar />
      </footer>
    </div>
  );
}