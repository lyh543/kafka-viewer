import { Toaster as Sonner, type ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      richColors
      position="top-right"
      toastOptions={{
        style: {
          borderRadius: '12px',
          border: '1px solid var(--border)',
          background: 'var(--card)',
          color: 'var(--foreground)',
        },
      }}
      {...props}
    />
  );
}