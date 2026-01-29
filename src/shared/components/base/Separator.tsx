import React from 'react';

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className = '', orientation = 'horizontal', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-gradient-to-r from-transparent via-gray-200 to-transparent ${
          orientation === 'horizontal' ? 'h-[2px] w-full' : 'h-full w-[2px]'
        } ${className}`}
        {...props}
      />
    );
  }
);

Separator.displayName = 'Separator';
