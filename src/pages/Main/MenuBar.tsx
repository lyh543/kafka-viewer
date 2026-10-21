import { useState } from 'react';
import { File, HelpCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ConnectionModal from '@/pages/ConnectionModal';
import AboutModal from './AboutModal';

interface MenuBarProps {
  onCloseProject: () => void;
}

function MenuButton({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-5 items-center rounded-[4px] px-1.5 text-[11px] text-foreground transition-colors hover:bg-surface-soft">
      {children}
    </div>
  );
}

export default function MenuBar({ onCloseProject }: MenuBarProps) {
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button">
              <MenuButton>
                <File className="mr-1 h-3 w-3" />
                文件
              </MenuButton>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setConnectionModalOpen(true)}>
              管理连接
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCloseProject}>关闭项目</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button">
              <MenuButton>
                <HelpCircle className="mr-1 h-3 w-3" />
                帮助
              </MenuButton>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem disabled>检查更新</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setAboutModalOpen(true)}>关于</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConnectionModal onClose={() => setConnectionModalOpen(false)} open={connectionModalOpen} />
      <AboutModal onClose={() => setAboutModalOpen(false)} open={aboutModalOpen} />
    </>
  );
}