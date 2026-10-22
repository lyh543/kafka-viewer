import { useEffect, useRef, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import ConnectionModal from '@/pages/ConnectionModal';
import AboutModal from './AboutModal';

interface MenuBarProps {
  onCloseProject: () => void;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Bridges native system menu events (built in Rust) to in-app dialogs.
 * The menu itself is rendered by the OS, so this component renders no toolbar.
 */
export default function MenuBar({ onCloseProject }: MenuBarProps) {
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const closeProjectRef = useRef(onCloseProject);

  useEffect(() => {
    closeProjectRef.current = onCloseProject;
  }, [onCloseProject]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let disposed = false;
    const unlistenFns: UnlistenFn[] = [];

    async function register() {
      const registrations = await Promise.all([
        listen('menu:manage-connections', () => setConnectionModalOpen(true)),
        listen('menu:about', () => setAboutModalOpen(true)),
        listen('menu:close-project', () => closeProjectRef.current()),
      ]);

      if (disposed) {
        registrations.forEach((unlisten) => unlisten());
        return;
      }

      unlistenFns.push(...registrations);
    }

    void register();

    return () => {
      disposed = true;
      unlistenFns.forEach((unlisten) => unlisten());
    };
  }, []);

  return (
    <>
      <ConnectionModal onClose={() => setConnectionModalOpen(false)} open={connectionModalOpen} />
      <AboutModal onClose={() => setAboutModalOpen(false)} open={aboutModalOpen} />
    </>
  );
}