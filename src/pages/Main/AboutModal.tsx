import { Github } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AboutModal({ open, onClose }: AboutModalProps) {
  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent className="w-[min(92vw,28rem)]">
        <DialogHeader>
          <DialogTitle>关于 Kafka Viewer</DialogTitle>
          <DialogDescription>一个现代化的 Kafka 桌面客户端</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 text-center">
          <div className="space-y-2">
            <h3 className="text-2xl font-medium text-foreground">Kafka Viewer</h3>
            <p className="text-sm text-muted">版本 0.1.0</p>
          </div>

          <div className="space-y-1 text-sm text-body">
            <p>作者: lyh543</p>
            <a
              className="inline-flex items-center gap-2 text-link transition-colors hover:text-link-active"
              href="https://github.com/lyh543/kafka-viewer"
              rel="noreferrer"
              target="_blank"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}