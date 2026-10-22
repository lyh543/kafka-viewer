import { useCallback, useEffect, useRef, useState } from 'react';
import * as connectionApi from '@/api/connection';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useConnectionStore } from '@/stores/connection';
import { useProjectStore } from '@/stores/project';
import { useSidebarStore } from '@/stores/sidebar';
import { frontendLogger } from '@/utils/logger';
import { notifyError } from '@/utils/notify';
import ContentArea from './ContentArea';
import MenuBar from './MenuBar';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';

type MainProps = {
  onCloseProject: () => void;
};

const SIDEBAR_WIDTH_KEY = 'kafka-viewer.sidebar-width';
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 720;

function readInitialWidth(): number {
  if (typeof window === 'undefined') {
    return 256;
  }

  const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));

  if (Number.isFinite(stored) && stored >= MIN_SIDEBAR_WIDTH && stored <= MAX_SIDEBAR_WIDTH) {
    return stored;
  }

  return 256;
}

export default function Main({ onCloseProject }: MainProps) {
  const collapsed = useSidebarStore((state) => state.collapsed);
  const toggle = useSidebarStore((state) => state.toggle);
  const currentProject = useProjectStore((state) => state.currentProject);
  const setConnections = useConnectionStore((state) => state.setConnections);
  const [sidebarWidth, setSidebarWidth] = useState(readInitialWidth);
  const widthRef = useRef(sidebarWidth);

  useEffect(() => {
    widthRef.current = sidebarWidth;
  }, [sidebarWidth]);

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
          notifyError(`加载连接失败: ${String(error)}`, error, 'main');
        }
      }
    }

    void loadConnections();

    return () => {
      cancelled = true;
    };
  }, [currentProject, setConnections]);

  const startResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = widthRef.current;
    let latestWidth = startWidth;

    const handleMove = (moveEvent: PointerEvent) => {
      latestWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, startWidth + moveEvent.clientX - startX)
      );
      setSidebarWidth(latestWidth);
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(latestWidth));
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, []);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full flex-col bg-canvas text-foreground">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside
            className="shrink-0 border-r border-border bg-white"
            style={{ width: collapsed ? 40 : sidebarWidth }}
          >
            <Sidebar collapsed={collapsed} onToggle={toggle} />
          </aside>

          {collapsed ? null : (
            <div
              aria-label="调整侧栏宽度"
              className="group relative z-10 -ml-px w-px shrink-0 cursor-col-resize bg-border"
              onDoubleClick={() => setSidebarWidth(256)}
              onPointerDown={startResize}
              role="separator"
            >
              <div className="absolute inset-y-0 -left-[3px] -right-[3px] transition-colors group-hover:bg-[color:var(--ring)]/40" />
            </div>
          )}

          <main className="min-w-0 flex-1 overflow-hidden">
            <ContentArea />
          </main>
        </div>

        <footer>
          <StatusBar />
        </footer>

        {/* Native menu bridge: dialogs and menu events only, no toolbar UI. */}
        <MenuBar onCloseProject={onCloseProject} />
      </div>
    </TooltipProvider>
  );
}