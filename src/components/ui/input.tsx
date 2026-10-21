import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    className={cn(
      'flex h-11 w-full rounded-[10px] border border-border bg-white px-4 py-2 text-sm text-foreground outline-none placeholder:text-placeholder placeholder:opacity-100 focus-visible:border-[color:var(--ring)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/20 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    ref={ref}
    {...props}
  />
));

Input.displayName = 'Input';

export { Input };