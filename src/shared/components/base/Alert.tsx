import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'success' | 'warning';
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className = '', variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-blue-50 border-blue-200 text-blue-900',
      destructive: 'bg-red-50 border-red-200 text-red-900',
      success: 'bg-green-50 border-green-200 text-green-900',
      warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={`relative w-full rounded-xl border-2 p-4 shadow-sm ${variants[variant]} ${className}`}
        {...props}
      />
    );
  }
);

Alert.displayName = 'Alert';

export const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <h5
        ref={ref}
        className={`mb-1 font-semibold leading-none tracking-tight ${className}`}
        {...props}
      />
    );
  }
);

AlertTitle.displayName = 'AlertTitle';

export const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`text-sm opacity-90 ${className}`}
        {...props}
      />
    );
  }
);

AlertDescription.displayName = 'AlertDescription';
