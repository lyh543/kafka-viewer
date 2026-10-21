import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { FolderOpen, Plus, Trash2 } from 'lucide-react';
import { homeDir } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';
import * as projectApi from '@/api/project';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/stores/project';
import type { RecentProject } from '@/types/project';

const DEFAULT_PROJECT_NAME = 'my-project';
const DEFAULT_PROJECT_PARENT = 'KafkaViewer/projects';

type WelcomeProps = {
  onProjectOpened: () => void;
};

async function buildDefaultProjectPath(name: string): Promise<string> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const home = await homeDir();
      return `${home.replace(/[\\/]+$/, '')}/${DEFAULT_PROJECT_PARENT}/${name}`;
    } catch {
      // Fall back to the literal path below when the path API is unavailable.
    }
  }

  return `~/${DEFAULT_PROJECT_PARENT}/${name}`;
}

export default function Welcome({ onProjectOpened }: WelcomeProps) {
  const { recentProjects, setRecentProjects, setCurrentProject } = useProjectStore();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formValues, setFormValues] = useState({ name: DEFAULT_PROJECT_NAME, path: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    projectApi.getRecentProjects().then(setRecentProjects).catch(console.error);
  }, [setRecentProjects]);

  const trimmedName = formValues.name.trim();
  const trimmedPath = formValues.path.trim();
  const canCreate = trimmedName.length > 0 && trimmedPath.length > 0 && !submitting;

  const versionLabel = useMemo(() => 'v0.1.0', []);

  const openCreateModal = async () => {
    setFormValues({
      name: DEFAULT_PROJECT_NAME,
      path: await buildDefaultProjectPath(DEFAULT_PROJECT_NAME),
    });
    setCreateModalOpen(true);
  };

  const updateName = (name: string) => {
    setFormValues((current) => {
      const next = { ...current, name };

      if (!current.path) {
        return next;
      }

      const normalizedPath = current.path.replace(/\\/g, '/');
      const lastSlashIndex = normalizedPath.lastIndexOf('/');

      if (lastSlashIndex === -1) {
        next.path = name;
        return next;
      }

      const basePath = normalizedPath.slice(0, lastSlashIndex + 1);
      next.path = `${basePath}${name}`;
      return next;
    });
  };

  const handleCreateProject = async () => {
    if (!trimmedName || !trimmedPath) {
      toast.error('请输入项目名称和项目位置');
      return;
    }

    setSubmitting(true);

    try {
      const project = await projectApi.createProject(trimmedName, trimmedPath);
      setCurrentProject(project);
      setCreateModalOpen(false);
      setFormValues({ name: DEFAULT_PROJECT_NAME, path: '' });
      onProjectOpened();
    } catch (error) {
      toast.error(`创建项目失败: ${String(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenProject = async () => {
    const selected = await open({ directory: true, title: '选择项目文件夹' });

    if (!selected) {
      return;
    }

    try {
      const project = await projectApi.openProject(selected);
      setCurrentProject(project);
      onProjectOpened();
    } catch (error) {
      toast.error(`打开项目失败: ${String(error)}`);
    }
  };

  const handleOpenRecent = async (recent: RecentProject) => {
    try {
      const project = await projectApi.openProject(recent.path);
      setCurrentProject(project);
      onProjectOpened();
    } catch (error) {
      toast.error(`打开项目失败: ${String(error)}`);
    }
  };

  const handleRemoveRecent = async (path: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    try {
      await projectApi.removeRecentProject(path);
      setRecentProjects(recentProjects.filter((project) => project.path !== path));
    } catch (error) {
      toast.error(`移除失败: ${String(error)}`);
    }
  };

  const handleBrowseFolder = async () => {
    const selected = await open({ directory: true, title: '选择项目保存位置' });

    if (!selected) {
      return;
    }

    const name = trimmedName || DEFAULT_PROJECT_NAME;
    setFormValues((current) => ({ ...current, path: `${selected}/${name}` }));
  };

  return (
    <main className="flex h-full justify-center overflow-y-auto bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-4 py-8 sm:px-6 sm:py-12">
      <Card className="my-auto w-full max-w-5xl overflow-hidden">
        <CardContent className="grid gap-0 p-0 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
          <section className="flex flex-col justify-between bg-white p-6 sm:p-10 lg:min-h-[520px] lg:p-12">
            <div className="space-y-8">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.28em] text-muted">Kafka Viewer</p>
                <h1 className="max-w-[22ch] text-[28px] font-normal leading-[1.15] tracking-tight text-balance text-foreground sm:text-4xl sm:leading-[1.1] lg:text-[40px]">
                  Pure workspace flow, rebuilt on a quieter visual system.
                </h1>
                <p className="max-w-xl text-sm leading-6 text-body">
                  Start a project, reopen an existing workspace, or continue from recent activity.
                  The underlying project state and Tauri workflow stay unchanged.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  className="group rounded-[12px] bg-primary p-6 text-left text-primary-foreground"
                  onClick={() => void openCreateModal()}
                  type="button"
                >
                  <div className="mb-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-medium">新建项目</h2>
                    <p className="text-sm leading-6 text-white/72">
                      选择名称与保存路径，创建一个新的 Kafka Viewer 工作区。
                    </p>
                  </div>
                </button>

                <button
                  className="group rounded-[12px] border border-border bg-surface-soft p-6 text-left text-foreground"
                  onClick={handleOpenProject}
                  type="button"
                >
                  <div className="mb-10 flex h-11 w-11 items-center justify-center rounded-full bg-white">
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-medium">打开项目</h2>
                    <p className="text-sm leading-6 text-body">
                      直接选择现有项目目录，恢复上次保存的连接与浏览上下文。
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <div className="mt-12 flex items-center justify-between border-t border-border pt-6 text-sm text-muted">
              <span>{versionLabel}</span>
              <span>Design language aligned to DESIGN.md</span>
            </div>
          </section>

          <section className="border-t border-border bg-signature-cream p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
            <CardHeader className="p-0">
              <CardTitle className="text-xl font-normal sm:text-2xl">最近的项目</CardTitle>
              <CardDescription className="max-w-sm leading-6 text-body">
                最近打开过的工作区会出现在这里，便于快速回到上一次调试上下文。
              </CardDescription>
            </CardHeader>

            <div className="mt-8 space-y-3">
              {recentProjects.length === 0 ? (
                <div className="rounded-[12px] border border-dashed border-border-strong bg-white/60 px-5 py-6 text-sm leading-6 text-body">
                  暂无最近项目。
                </div>
              ) : (
                recentProjects.map((project) => (
                  <button
                    className="group flex w-full items-start justify-between rounded-[12px] border border-transparent bg-white/78 px-4 py-4 text-left transition-colors hover:border-border hover:bg-white"
                    key={project.path}
                    onClick={() => handleOpenRecent(project)}
                    type="button"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="truncate text-sm font-medium text-foreground">{project.name}</div>
                      <div className="truncate text-xs leading-5 text-muted">{project.path}</div>
                    </div>
                    <button
                      aria-label={`移除 ${project.name}`}
                      className="ml-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
                      onClick={(event) => handleRemoveRecent(project.path, event)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </button>
                ))
              )}
            </div>
          </section>
        </CardContent>
      </Card>

      <Dialog onOpenChange={setCreateModalOpen} open={createModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
            <DialogDescription>
              创建项目时仅替换 UI 交互；底层项目创建流程仍使用现有 Tauri API。
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="project-name">
                项目名称
              </label>
              <Input
                id="project-name"
                onChange={(event) => updateName(event.target.value)}
                placeholder="my-project"
                value={formValues.name}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="project-path">
                项目位置
              </label>
              <div className="flex gap-3">
                <Input
                  className="flex-1"
                  id="project-path"
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, path: event.target.value }))
                  }
                  placeholder="~/KafkaViewer/projects/my-project"
                  value={formValues.path}
                />
                <Button onClick={handleBrowseFolder} variant="outline">
                  <FolderOpen className="h-4 w-4" />
                  浏览
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setCreateModalOpen(false)} variant="outline">
              取消
            </Button>
            <Button disabled={!canCreate} onClick={handleCreateProject}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}