import { useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { CheckCircle2, Copy, Database, LoaderCircle, Plus, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import * as connectionApi from '@/api/connection';
import { useConnectionStore } from '@/stores/connection';
import type {
  AuthConfig,
  KafkaConnection,
  TestConnectionProgress,
  TestConnectionResult,
} from '@/types/connection';

interface ConnectionModalProps {
  open: boolean;
  onClose: () => void;
}

const AUTH_OPTIONS = [
  { label: '无认证', value: 'none' },
  { label: 'SASL/PLAIN', value: 'sasl_plain' },
  { label: 'SASL/SCRAM-256', value: 'sasl_scram_256' },
  { label: 'SASL/SCRAM-512', value: 'sasl_scram_512' },
  { label: 'SSL', value: 'ssl' },
] as const;

type ConnectionFormState = {
  name: string;
  brokers: string;
  auth_type: AuthConfig['type'];
  username: string;
  password: string;
};

const EMPTY_FORM: ConnectionFormState = {
  name: '',
  brokers: '',
  auth_type: 'none',
  username: '',
  password: '',
};

function toFormState(connection: KafkaConnection): ConnectionFormState {
  return {
    name: connection.name,
    brokers: connection.brokers,
    auth_type: connection.auth.type,
    username: connection.auth.username ?? '',
    password: connection.auth.password ?? '',
  };
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <label className="text-[13px] font-medium text-foreground" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="flex h-9 w-full rounded-[10px] border border-border bg-white px-3 py-1.5 text-[13px] text-foreground outline-none focus-visible:border-[color:var(--ring)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/20"
      {...props}
    />
  );
}

export default function ConnectionModal({ open, onClose }: ConnectionModalProps) {
  const connections = useConnectionStore((state) => state.connections);
  const setConnections = useConnectionStore((state) => state.setConnections);
  const addConnection = useConnectionStore((state) => state.addConnection);
  const updateConnection = useConnectionStore((state) => state.updateConnection);
  const removeConnection = useConnectionStore((state) => state.removeConnection);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const [formValues, setFormValues] = useState<ConnectionFormState>(EMPTY_FORM);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [testStep, setTestStep] = useState<string | null>(null);
  const testRequestIdRef = useRef(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    connectionApi.getConnections().then(setConnections).catch((error) => {
      toast.error(`加载连接失败: ${String(error)}`);
    });
  }, [open, setConnections]);

  useEffect(() => {
    if (open) {
      return;
    }

    // Closing the dialog always drops the in-progress draft: nothing is
    // persisted until the user saves.
    testRequestIdRef.current += 1;
    setTesting(false);
    setTestResult(null);
    setTestStep(null);
    setSelectedId(null);
    setIsDraft(false);
    setFormValues(EMPTY_FORM);
    setDirty(false);
  }, [open]);

  useEffect(() => {
    let disposed = false;
    let unlisten: undefined | (() => void);

    void listen<TestConnectionProgress>('connection-test-progress', (event) => {
      const payload = event.payload;

      if (!payload) {
        return;
      }

      if (payload.request_id !== testRequestIdRef.current) {
        return;
      }

      if (payload.connection_id !== selectedId) {
        return;
      }

      setTestStep(payload.message);
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }

      unlisten = cleanup;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [selectedId]);

  const showCredentials = formValues.auth_type !== 'none' && formValues.auth_type !== 'ssl';
  const hasValidForm = formValues.name.trim().length > 0 && formValues.brokers.trim().length > 0;
  const canSave = Boolean(selectedId) && (isDraft || dirty) && hasValidForm;

  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.id === selectedId) ?? null,
    [connections, selectedId]
  );

  const resetTestState = () => {
    testRequestIdRef.current += 1;
    setTesting(false);
    setTestResult(null);
    setTestStep(null);
  };

  /** Selects a persisted connection, replacing the current draft (if any). */
  const selectConnection = (connection: KafkaConnection) => {
    resetTestState();
    setSelectedId(connection.id);
    setIsDraft(false);
    setFormValues(toFormState(connection));
    setDirty(false);
  };

  /** Starts editing a local-only connection. Nothing is persisted until saving. */
  const startDraft = (draft: KafkaConnection) => {
    resetTestState();
    setSelectedId(draft.id);
    setIsDraft(true);
    setFormValues(toFormState(draft));
    setDirty(true);
  };

  const discardDraft = () => {
    resetTestState();
    setSelectedId(null);
    setIsDraft(false);
    setFormValues(EMPTY_FORM);
    setDirty(false);
  };

  const updateField = <K extends keyof ConnectionFormState>(field: K, value: ConnectionFormState[K]) => {
    setFormValues((current) => ({ ...current, [field]: value }));
    setDirty(true);
  };

  const validateForm = () => {
    if (!formValues.name.trim()) {
      throw new Error('请输入连接名称');
    }

    if (!formValues.brokers.trim()) {
      throw new Error('请输入 Broker 地址');
    }
  };

  const buildConnectionFromForm = (id: string): KafkaConnection => {
    const auth: AuthConfig = {
      type: formValues.auth_type,
      ...(showCredentials
        ? {
            username: formValues.username,
            password: formValues.password,
          }
        : {}),
    };

    return {
      id,
      name: formValues.name.trim(),
      brokers: formValues.brokers.trim(),
      auth,
      created_at: selectedConnection?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  };

  const handleNew = () => {
    const nextConnection: KafkaConnection = {
      id: crypto.randomUUID(),
      name: '新连接',
      brokers: 'localhost:9092',
      auth: { type: 'none' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Kept in local state only; the store/backend see it after the first save.
    startDraft(nextConnection);
  };

  const handleDuplicate = () => {
    if (!selectedId) {
      return;
    }

    const source = buildConnectionFromForm(selectedId);
    const duplicate: KafkaConnection = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} (副本)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    startDraft(duplicate);
  };

  const handleDelete = async () => {
    if (!selectedId) {
      return;
    }

    if (isDraft) {
      discardDraft();
      return;
    }

    const deletingId = selectedId;
    resetTestState();
    removeConnection(deletingId);
    setSelectedId(null);
    setFormValues(EMPTY_FORM);
    setDirty(false);

    try {
      await connectionApi.deleteConnection(deletingId);
    } catch (error) {
      toast.error(`删除失败: ${String(error)}`);
    }
  };

  const handleTest = async () => {
    if (!selectedId) {
      return;
    }

    if (testing) {
      testRequestIdRef.current += 1;
      setTesting(false);
      setTestStep(null);
      setTestResult({ success: false, message: '测试已取消' });
      return;
    }

    try {
      validateForm();
    } catch (error) {
      toast.error(String(error));
      return;
    }

    const requestId = testRequestIdRef.current + 1;
    testRequestIdRef.current = requestId;
    setTesting(true);
    setTestResult(null);
    setTestStep('准备开始连接测试...');

    try {
      const result = await connectionApi.testConnection(buildConnectionFromForm(selectedId), requestId);

      if (testRequestIdRef.current !== requestId) {
        return;
      }

      setTestResult(result);
      setTestStep(null);
    } catch (error) {
      if (testRequestIdRef.current !== requestId) {
        return;
      }

      setTestResult({ success: false, message: String(error) });
      setTestStep(null);
    } finally {
      if (testRequestIdRef.current === requestId) {
        setTesting(false);
      }
    }
  };

  const handleSave = async () => {
    if (!selectedId) {
      return false;
    }

    try {
      validateForm();
      const saved = await connectionApi.saveConnection(buildConnectionFromForm(selectedId));

      if (isDraft) {
        addConnection(saved);
      } else {
        updateConnection(saved);
      }

      setSelectedId(saved.id);
      setIsDraft(false);
      setFormValues(toFormState(saved));
      setDirty(false);
      toast.success('连接已保存');
      return true;
    } catch (error) {
      toast.error(`保存失败: ${String(error)}`);
      return false;
    }
  };

  const handleSaveAndClose = async () => {
    const saved = await handleSave();

    if (saved) {
      onClose();
    }
  };

  const renderResultTone = (success: boolean) =>
    success
      ? 'border-[#39bf45]/30 bg-[#39bf45]/8 text-[#006400]'
      : 'border-[#aa2d00]/20 bg-[#aa2d00]/8 text-[#aa2d00]';

  const connectionItemClass = (selected: boolean) =>
    selected
      ? 'w-full rounded-[10px] border border-transparent bg-white px-3 py-2 text-left shadow-[0_8px_24px_rgba(24,29,38,0.08)]'
      : 'w-full rounded-[10px] border border-transparent bg-white/72 px-3 py-2 text-left transition-colors hover:border-border hover:bg-white';

  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,72rem)] overflow-hidden p-0">
        <div className="grid h-[min(86vh,600px)] min-h-0 grid-cols-[240px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-r border-border bg-surface-soft p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Connections</p>
                <h2 className="mt-1 text-base font-medium text-foreground">管理连接</h2>
              </div>
              <Button aria-label="新增连接" onClick={handleNew} size="icon" variant="secondary">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-3 flex gap-2">
              <Button disabled={!selectedId} onClick={handleDuplicate} size="sm" variant="outline">
                <Copy className="h-4 w-4" />
                复制
              </Button>
              <Button disabled={!selectedId} onClick={() => void handleDelete()} size="sm" variant="outline">
                <Trash2 className="h-4 w-4" />
                删除
              </Button>
            </div>

            <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
              {connections.length === 0 && !isDraft ? (
                <div className="rounded-[10px] border border-dashed border-border-strong bg-white px-3 py-4 text-[13px] leading-5 text-body">
                  暂无连接。点击右上角新增一个连接开始配置。
                </div>
              ) : null}

              {isDraft && selectedId ? (
                <button className={connectionItemClass(true)} key={selectedId} type="button">
                  <div className="truncate text-[13px] font-medium text-foreground">
                    {formValues.name.trim() || '新连接'}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {formValues.brokers.trim() || '-'}
                  </div>
                </button>
              ) : null}

              {connections.map((connection) => (
                <button
                  className={connectionItemClass(selectedId === connection.id)}
                  key={connection.id}
                  onClick={() => selectConnection(connection)}
                  type="button"
                >
                  <div className="truncate text-[13px] font-medium text-foreground">{connection.name}</div>
                  <div className="mt-0.5 truncate text-xs text-muted">{connection.brokers}</div>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col overflow-y-auto p-6">
            {selectedId ? (
              <div className="flex h-full flex-col">
                <DialogHeader>
                  <DialogTitle className="text-lg">{formValues.name.trim() || '连接设置'}</DialogTitle>
                  <DialogDescription className="text-[13px] leading-5">
                    编辑 Kafka 连接配置，测试后保存到当前项目。
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4 grid gap-3">
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="connection-name">连接名称</FieldLabel>
                    <Input
                      className="h-9 px-3 text-[13px]"
                      id="connection-name"
                      onChange={(event) => updateField('name', event.target.value)}
                      placeholder="开发环境"
                      value={formValues.name}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="connection-brokers">Brokers</FieldLabel>
                    <Input
                      className="h-9 px-3 text-[13px]"
                      id="connection-brokers"
                      onChange={(event) => updateField('brokers', event.target.value)}
                      placeholder="localhost:9092"
                      value={formValues.brokers}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="connection-auth-type">身份验证</FieldLabel>
                    <SelectField
                      id="connection-auth-type"
                      onChange={(event) => updateField('auth_type', event.target.value as AuthConfig['type'])}
                      value={formValues.auth_type}
                    >
                      {AUTH_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </SelectField>
                  </div>

                  {showCredentials ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <FieldLabel htmlFor="connection-username">用户名</FieldLabel>
                        <Input
                          className="h-9 px-3 text-[13px]"
                          id="connection-username"
                          onChange={(event) => updateField('username', event.target.value)}
                          placeholder="username"
                          value={formValues.username}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <FieldLabel htmlFor="connection-password">密码</FieldLabel>
                        <Input
                          className="h-9 px-3 text-[13px]"
                          id="connection-password"
                          onChange={(event) => updateField('password', event.target.value)}
                          placeholder="password"
                          type="password"
                          value={formValues.password}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-start gap-3">
                    <Button
                      onClick={() => void handleTest()}
                      size="sm"
                      variant={testing ? 'destructive' : 'default'}
                    >
                      {testing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                      {testing ? '取消测试' : '测试连接'}
                    </Button>

                    <div className="min-w-0 flex-1">
                      {testResult ? (
                        <div
                          className={`flex items-start gap-2 rounded-[10px] border px-3 py-2 text-[13px] leading-5 ${renderResultTone(testResult.success)}`}
                        >
                          {testResult.success ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                          ) : (
                            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          )}
                          <span className="min-w-0 break-words">{testResult.message}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {testing && testStep ? (
                    <p className="text-[13px] text-muted">当前步骤: {testStep}</p>
                  ) : null}

                  {testResult?.success ? (
                    <div className="rounded-[10px] border border-border bg-signature-cream/55 p-4">
                      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                        {[
                          {
                            label: 'Ping',
                            value: testResult.ping_ms != null ? `${testResult.ping_ms} ms` : '-',
                          },
                          { label: 'Broker 数', value: testResult.broker_count ?? '-' },
                          { label: 'Topic 数', value: testResult.topic_count ?? '-' },
                          { label: '分区总数', value: testResult.partition_count ?? '-' },
                        ].map((item) => (
                          <div
                            className="flex items-baseline justify-between gap-3 border-b border-dashed border-border/70 py-1 text-[13px] last:border-b-0"
                            key={item.label}
                          >
                            <span className="text-muted">{item.label}</span>
                            <span className="font-medium text-foreground">{item.value}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex items-baseline gap-3 border-t border-border pt-3 text-[13px]">
                        <span className="shrink-0 text-muted">Broker 节点</span>
                        <span className="min-w-0 break-words text-body">
                          {testResult.brokers && testResult.brokers.length > 0
                            ? testResult.brokers.map((broker) => `${broker.host}:${broker.port}`).join(', ')
                            : '-'}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <DialogFooter className="mt-auto border-t border-border pt-4">
                  <Button onClick={onClose} size="sm" variant="outline">
                    取消
                  </Button>
                  <Button disabled={!canSave} onClick={() => void handleSave()} size="sm">
                    保存
                  </Button>
                  <Button disabled={!canSave} onClick={() => void handleSaveAndClose()} size="sm">
                    保存并关闭
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <DialogTitle className="sr-only">管理连接</DialogTitle>
                <DialogDescription className="sr-only">
                  选择左侧已有连接进行编辑，或点击右上角新建一个连接。
                </DialogDescription>
                <div className="max-w-md rounded-[12px] bg-signature-cream p-8 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-foreground">
                    <Database className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-xl font-medium text-foreground">请选择或新建一个连接</h3>
                  <p className="mt-3 text-sm leading-6 text-body">
                    左侧列表展示当前项目中的 Kafka 连接。选择一个连接开始编辑，或点击右上角新建。
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}