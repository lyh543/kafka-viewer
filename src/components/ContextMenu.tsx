import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type ContextMenuItem = {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  /** Renders the item as disabled with a "尚未实现" tooltip. */
  unimplemented?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
};

export type ContextMenuPosition = { x: number; y: number } | null;

interface ContextMenuProps {
  position: ContextMenuPosition;
  items: ContextMenuItem[];
  onClose: () => void;
}

/**
 * Lightweight right-click menu shared by the sidebar and data tables.
 * Renders into a portal so it is never clipped by scroll containers.
 */
export default function ContextMenu({ position, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!position || !menuRef.current) {
      setAdjusted(null);
      return;
    }

    const rect = menuRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(position.x, window.innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(position.y, window.innerHeight - rect.height - 8));

    setAdjusted({ left, top });
  }, [position, items.length]);

  useEffect(() => {
    if (!position) {
      return;
    }

    const close = () => onClose();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [position, onClose]);

  if (!position || items.length === 0) {
    return null;
  }

  return createPortal(
    <div
      className="fixed z-[100] min-w-36 rounded-[6px] border border-border bg-white p-0.5 shadow-[0_16px_48px_rgba(24,29,38,0.16)]"
      ref={menuRef}
      style={{ left: adjusted?.left ?? position.x, top: adjusted?.top ?? position.y }}
    >
      {items.map((item) => {
        const button = (
          <button
            className={cn(
              'flex w-full items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-left text-sm text-foreground transition-colors hover:bg-surface-soft',
              item.danger && 'text-signature-coral hover:bg-signature-peach/20',
              item.unimplemented && 'cursor-default text-muted opacity-60 hover:bg-transparent'
            )}
            onClick={() => {
              if (item.unimplemented) {
                return;
              }

              onClose();
              item.onClick?.();
            }}
            type="button"
          >
            {item.icon ? <span className="text-muted">{item.icon}</span> : null}
            <span className="flex-1 text-left">{item.label}</span>
            {item.unimplemented ? <span className="text-xs text-muted">尚未实现</span> : null}
          </button>
        );

        return (
          <Fragment key={item.label}>
            {item.separatorBefore ? <div className="my-1 h-px bg-border" /> : null}
            {item.unimplemented ? (
              <Tooltip>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent>尚未实现</TooltipContent>
              </Tooltip>
            ) : (
              button
            )}
          </Fragment>
        );
      })}
    </div>,
    document.body
  );
}
