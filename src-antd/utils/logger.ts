import { invoke } from '@tauri-apps/api/core';

type FrontendLogLevel = 'debug' | 'info' | 'warn' | 'error';
type ConsoleMethod = 'debug' | 'info' | 'log' | 'warn' | 'error';

const originalConsole = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

let consoleForwardingAttached = false;
let globalErrorHandlersAttached = false;

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function truncate(value: string, maxLength = 500): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...<trimmed ${value.length - maxLength} chars>`;
}

function sanitizeForLog(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: truncate(value.stack ?? value.message, 2000),
    };
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeForLog);
  }

  if (typeof value === 'string') {
    return truncate(value);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => {
        const normalizedKey = key.toLowerCase();

        if (
          normalizedKey.includes('password') ||
          normalizedKey.includes('secret') ||
          normalizedKey.includes('token')
        ) {
          return [key, '<redacted>'];
        }

        return [key, sanitizeForLog(nestedValue)];
      })
    );
  }

  return value;
}

function serializeArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      const sanitized = sanitizeForLog(arg);

      if (typeof sanitized === 'string') {
        return sanitized;
      }

      try {
        return JSON.stringify(sanitized);
      } catch {
        return String(sanitized);
      }
    })
    .join(' ');
}

function writeLocalConsole(level: FrontendLogLevel, scope: string, args: unknown[]): void {
  const method: ConsoleMethod = level === 'info' ? 'info' : level;
  originalConsole[method](`[frontend:${scope}]`, ...args);
}

async function forwardToBackend(
  level: FrontendLogLevel,
  scope: string,
  args: unknown[]
): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    await invoke('log_frontend', {
      level,
      scope,
      message: serializeArgs(args),
    });
  } catch (error) {
    originalConsole.warn('[frontend:logger] Failed to forward log to backend', error);
  }
}

function emit(level: FrontendLogLevel, scope: string, ...args: unknown[]): void {
  writeLocalConsole(level, scope, args);
  void forwardToBackend(level, scope, args);
}

export const frontendLogger = {
  debug(scope: string, ...args: unknown[]): void {
    emit('debug', scope, ...args);
  },
  info(scope: string, ...args: unknown[]): void {
    emit('info', scope, ...args);
  },
  warn(scope: string, ...args: unknown[]): void {
    emit('warn', scope, ...args);
  },
  error(scope: string, ...args: unknown[]): void {
    emit('error', scope, ...args);
  },
};

export function attachConsoleForwarding(): void {
  if (consoleForwardingAttached) {
    return;
  }

  console.debug = (...args: unknown[]) => {
    originalConsole.debug(...args);
    void forwardToBackend('debug', 'console', args);
  };

  console.info = (...args: unknown[]) => {
    originalConsole.info(...args);
    void forwardToBackend('info', 'console', args);
  };

  console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    void forwardToBackend('info', 'console', args);
  };

  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    void forwardToBackend('warn', 'console', args);
  };

  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    void forwardToBackend('error', 'console', args);
  };

  consoleForwardingAttached = true;
}

export function attachGlobalErrorHandlers(): void {
  if (globalErrorHandlersAttached || typeof window === 'undefined') {
    return;
  }

  window.addEventListener('error', (event) => {
    emit('error', 'window.error', {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    emit('error', 'window.unhandledrejection', event.reason);
  });

  globalErrorHandlersAttached = true;
}

export async function invokeLogged<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  const startedAt = performance.now();

  frontendLogger.info('invoke', `-> ${command}`, args ?? {});

  try {
    const result = await invoke<T>(command, args);
    const elapsedMs = Math.round(performance.now() - startedAt);

    frontendLogger.info('invoke', `<- ${command} ok (${elapsedMs}ms)`);
    return result;
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startedAt);

    frontendLogger.error('invoke', `<- ${command} failed (${elapsedMs}ms)`, error);
    throw error;
  }
}