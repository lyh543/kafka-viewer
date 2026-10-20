import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-[#0d1218]',
        secondary: 'bg-surface-soft text-foreground hover:bg-[#eef2f6]',
        outline: 'border border-border bg-white text-foreground hover:bg-surface-soft',
        ghost: 'text-foreground hover:bg-surface-soft',
        link: 'rounded-none px-0 text-link hover:text-link-active',
        destructive: 'bg-signature-coral text-primary-foreground hover:opacity-90',
      },
      size: {
        default: 'h-11 px-5 py-2.5',
        sm: 'h-9 rounded-[10px] px-3.5',
        lg: 'h-12 px-6',
        icon: 'h-10 w-10 rounded-full px-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      ref={ref}
      type={type}
      {...props}
    />
  )
);

Button.displayName = 'Button';

export { Button, buttonVariants };