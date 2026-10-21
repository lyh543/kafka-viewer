import { toast } from 'sonner';
import { useLogStore } from '@/stores/log';
import { frontendLogger } from './logger';

/**
 * Logs an error (frontend + backend log file) and shows a toast with a
 * "打开日志" action that opens the in-app log viewer.
 */
export function notifyError(message: string, error?: unknown, scope = 'ui'): void {
  frontendLogger.error(scope, message, error ?? '');

  toast.error(message, {
    action: {
      label: '打开日志',
      onClick: () => {
        void useLogStore.getState().openDialog();
      },
    },
  });
}
