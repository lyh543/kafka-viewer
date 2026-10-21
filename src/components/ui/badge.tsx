import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'border-border bg-surface-soft text-body',
        outline: 'border-border bg-white text-body',
        success: 'border-transparent bg-[#e3f2e1] text-[#006400]',
        warning: 'border-transparent bg-[#fdf0dc] text-[#8a4b00]',
        danger: 'border-transparent bg-[#fbe5e0] text-signature-coral',
        info: 'border-transparent bg-[#e6effa] text-link',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);

export { Badge, badgeVariants };
