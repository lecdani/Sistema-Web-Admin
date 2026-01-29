import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success';
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className = '', variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-blue-100 text-blue-700 border-blue-200',
      secondary: 'bg-gray-100 text-gray-700 border-gray-200',
      destructive: 'bg-red-100 text-red-700 border-red-200',
      success: 'bg-green-100 text-green-700 border-green-200',
      outline: 'bg-white text-gray-700 border-gray-300',
    };

    return (
      <div
        ref={ref}
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${variants[variant]} ${className}`}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';
