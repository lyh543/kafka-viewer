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
    <label className="text-sm font-medium text-foreground" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="flex h-11 w-full rounded-[10px] border border-border bg-white px-4 py-2 text-sm text-foreground outline-none focus-visible:border-[color:var(--ring)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/20"
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
    if (!selectedId) {
      return;
    }

    const connection = connections.find((item) => item.id === selectedId);

    if (!connection) {
      return;
    }

    setFormValues(toFormState(connection));
    setTestResult(null);
    setDirty(false);
  }, [selectedId, connections]);

  useEffect(() => {
    if (!open) {
      testRequestIdRef.current += 1;
      setTesting(false);
      setTestResult(null);
      setTestStep(null);
    }
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
  const canSave = Boolean(selectedId) && dirty;

  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.id === selectedId) ?? null,
    [connections, selectedId]
  );

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

  const buildConnectionFromForm = (): KafkaConnection => {
    if (!selectedId) {
      throw new Error('未选择连接');
    }

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
      id: selectedId,
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

    addConnection(nextConnection);
    setSelectedId(nextConnection.id);
    setFormValues(toFormState(nextConnection));
    setTestResult(null);
    setTesting(false);
    setTestStep(null);
    setDirty(true);
  };

  const handleDuplicate = () => {
    if (!selectedConnection) {
      return;
    }

    const duplicate: KafkaConnection = {
      ...selectedConnection,
      id: crypto.randomUUID(),
      name: `${selectedConnection.name} (副本)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    addConnection(duplicate);
    setSelectedId(duplicate.id);
    setFormValues(toFormState(duplicate));
    setTestResult(null);
    setTesting(false);
    setTestStep(null);
    setDirty(true);
  };

  const handleDelete = async () => {
    if (!selectedId) {
      return;
    }

    const deletingId = selectedId;
    testRequestIdRef.current += 1;
    setTesting(false);
    setTestResult(null);
    setTestStep(null);
    removeConnection(deletingId);
    setSelectedId(null);
    setFormValues(EMPTY_FORM);

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
      const result = await connectionApi.testConnection(buildConnectionFromForm(), requestId);

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
      const saved = await connectionApi.saveConnection(buildConnectionFromForm());
      updateConnection(saved);
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

  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent className="w-[min(96vw,72rem)] p-0">
        <div className="grid min-h-[520px] grid-cols-[280px_minmax(0,1fr)] overflow-hidden">
          <aside className="border-r border-border bg-surface-soft p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted">Connections</p>
                <h2 className="mt-2 text-lg font-medium text-foreground">管理连接</h2>
              </div>
              <Button onClick={handleNew} size="icon" variant="secondary">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 flex gap-2">
              <Button disabled={!selectedId} onClick={handleDuplicate} size="sm" variant="outline">
                <Copy className="h-4 w-4" />
                复制
              </Button>
              <Button disabled={!selectedId} onClick={() => void handleDelete()} size="sm" variant="outline">
                <Trash2 className="h-4 w-4" />
                删除
              </Button>
            </div>

            <div className="mt-6 space-y-2">
              {connections.length === 0 ? (
                <div className="rounded-[12px] border border-dashed border-border-strong bg-white px-4 py-5 text-sm leading-6 text-body">
                  暂无连接。点击右上角新增一个连接开始配置。
                </div>
              ) : (
                connections.map((connection) => (
                  <button
                    className={selectedId === connection.id
                      ? 'w-full rounded-[12px] border border-transparent bg-white px-4 py-3 text-left shadow-[0_12px_32px_rgba(24,29,38,0.08)]'
                      : 'w-full rounded-[12px] border border-transparent bg-white/72 px-4 py-3 text-left transition-colors hover:border-border hover:bg-white'}
                    key={connection.id}
                    onClick={() => setSelectedId(connection.id)}
                    type="button"
                  >
                    <div className="truncate text-sm font-medium text-foreground">{connection.name}</div>
                    <div className="mt-1 truncate text-xs text-muted">{connection.brokers}</div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="flex flex-col justify-between p-8">
            {selectedId ? (
              <div className="flex h-full flex-col">
                <DialogHeader>
                  <DialogTitle>{selectedConnection?.name ?? '连接设置'}</DialogTitle>
                  <DialogDescription>编辑 Kafka 连接配置，测试后保存到当前项目。</DialogDescription>
                </DialogHeader>

                <div className="mt-6 grid gap-5">
                  <div className="space-y-2">
                    <FieldLabel htmlFor="connection-name">连接名称</FieldLabel>
                    <Input
                      id="connection-name"
                      onChange={(event) => updateField('name', event.target.value)}
                      placeholder="开发环境"
                      value={formValues.name}
                    />
                  </div>

                  <div className="space-y-2">
                    <FieldLabel htmlFor="connection-brokers">Brokers</FieldLabel>
                    <Input
                      id="connection-brokers"
                      onChange={(event) => updateField('brokers', event.target.value)}
                      placeholder="localhost:9092"
                      value={formValues.brokers}
                    />
                  </div>

                  <div className="space-y-2">
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
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <FieldLabel htmlFor="connection-username">用户名</FieldLabel>
                        <Input
                          id="connection-username"
                          onChange={(event) => updateField('username', event.target.value)}
                          placeholder="username"
                          value={formValues.username}
                        />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel htmlFor="connection-password">密码</FieldLabel>
                        <Input
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
                    <Button onClick={() => void handleTest()} variant={testing ? 'destructive' : 'default'}>
                      {testing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                      {testing ? '取消测试' : '测试连接'}
                    </Button>

                    <div className="min-w-0 flex-1">
                      {testResult ? (
                        <div className={`rounded-[12px] border px-4 py-3 text-sm ${renderResultTone(testResult.success)}`}>
                          <div className="flex items-start gap-2">
                            {testResult.success ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                            ) : (
                              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            )}
                            <span className="min-w-0 break-words">{testResult.message}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {testing && testStep ? (
                    <p className="text-sm text-muted">当前步骤: {testStep}</p>
                  ) : null}

                  {testResult?.success ? (
                    <div className="rounded-[12px] border border-border bg-signature-cream/55 p-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted">Ping</p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {testResult.ping_ms != null ? `${testResult.ping_ms} ms` : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted">Broker 数</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{testResult.broker_count ?? '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted">Topic 数</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{testResult.topic_count ?? '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted">分区总数</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{testResult.partition_count ?? '-'}</p>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-border pt-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted">Broker 节点</p>
                        <p className="mt-2 text-sm leading-6 text-body">
                          {testResult.brokers && testResult.brokers.length > 0
                            ? testResult.brokers.map((broker) => `${broker.host}:${broker.port}`).join(', ')
                            : '-'}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>

                <DialogFooter className="mt-auto border-t border-border pt-6">
                  <Button onClick={onClose} variant="outline">
                    取消
                  </Button>
                  <Button disabled={!canSave} onClick={() => void handleSave()}>
                    保存
                  </Button>
                  <Button disabled={!canSave} onClick={() => void handleSaveAndClose()}>
                    保存并关闭
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
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