import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Main from './pages/Main';
import Welcome from './pages/Welcome';
import LogDialog from './components/LogDialog';
import { Toaster } from './components/ui/sonner';
import { frontendLogger } from './utils/logger';
import { notifyError } from './utils/notify';
import * as projectApi from './api/project';
import { useProjectStore } from './stores/project';

export default function App() {
  const { currentProject, setCurrentProject, setRecentProjects } = useProjectStore();
  const [projectOpen, setProjectOpen] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    const windowTitle = currentProject ? `${currentProject.name} - kafka-viewer` : 'kafka-viewer';

    document.title = windowTitle;

    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      void getCurrentWindow().setTitle(windowTitle);
    }
  }, [currentProject]);

  useEffect(() => {
    let cancelled = false;

    async function restoreLastProject() {
      frontendLogger.info('app', 'Checking last opened project');

      try {
        const recentProjects = await projectApi.getRecentProjects();

        if (cancelled) {
          return;
        }

        setRecentProjects(recentProjects);

        const lastProject = recentProjects[0];

        if (!lastProject) {
          frontendLogger.info('app', 'No recent project found, showing welcome screen');
          return;
        }

        frontendLogger.info('app', 'Restoring last opened project', {
          name: lastProject.name,
          path: lastProject.path,
        });

        const project = await projectApi.openProject(lastProject.path);

        if (cancelled) {
          return;
        }

        setCurrentProject(project);
        setProjectOpen(true);
      } catch (error) {
        if (!cancelled) {
          frontendLogger.error('app', 'Failed to restore last opened project', error);
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    }

    void restoreLastProject();

    return () => {
      cancelled = true;
    };
  }, [setCurrentProject, setRecentProjects]);

  useEffect(() => {
    frontendLogger.info('app', 'Project view changed', {
      projectOpen,
      screen: projectOpen ? 'main' : 'welcome',
    });
  }, [projectOpen]);

  if (bootstrapping) {
    return null;
  }

  return (
    <>
      {projectOpen ? (
        <Main
          onCloseProject={() => {
            void (async () => {
              try {
                await projectApi.closeProject();
              } catch (error) {
                notifyError(`关闭项目失败: ${String(error)}`, error, 'app');
                return;
              }

              setCurrentProject(null);
              setProjectOpen(false);
            })();
          }}
        />
      ) : (
        <Welcome onProjectOpened={() => setProjectOpen(true)} />
      )}
      <LogDialog />
      <Toaster />
    </>
  );
}