import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';
    
    const variants = {
      default: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 shadow-sm',
      destructive: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 shadow-sm',
      outline: 'border border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 text-gray-700 focus-visible:ring-gray-400',
      ghost: 'hover:bg-gray-100 text-gray-700 focus-visible:ring-gray-400',
      link: 'text-blue-600 underline-offset-4 hover:underline focus-visible:ring-blue-600',
    };
    
    const sizes = {
      default: 'h-10 px-4 py-2',
      sm: 'h-8 px-3 text-sm',
      lg: 'h-11 px-6',
      icon: 'h-10 w-10',
    };
    
    const combinedClassName = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;
    
    if (asChild && React.isValidElement(props.children)) {
      const child = props.children as React.ReactElement<any>;
      const existingClassName = (child.props as { className?: string })?.className || '';
      return React.cloneElement(child, {
        ...child.props,
        className: `${existingClassName} ${combinedClassName}`.trim(),
        ref,
        ...props,
      } as Partial<any>);
    }
    
    return (
      <button
        className={combinedClassName}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
