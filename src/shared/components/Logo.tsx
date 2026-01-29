import React from 'react';
import { Building2 } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
  variant?: 'light' | 'dark';
}

export const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showText = true, 
  className = '',
  variant = 'light'
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  const iconColor = variant === 'light' ? 'text-white' : 'text-indigo-600';
  const textColor = variant === 'light' ? 'text-white' : 'text-gray-900';
  const subtitleColor = variant === 'light' ? 'text-indigo-100' : 'text-gray-500';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative">
        <div className={`${sizeClasses[size]} bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm ${variant === 'dark' ? 'bg-indigo-50 border border-indigo-200' : ''}`}>
          <Building2 className={`${size === 'sm' ? 'h-4 w-4' : size === 'md' ? 'h-5 w-5' : 'h-6 w-6'} ${iconColor}`} />
        </div>
      </div>
      {showText && (
        <div className="flex flex-col">
          <h1 className={`${textSizeClasses[size]} font-bold ${textColor} leading-none`}>
            Tu Empresa
          </h1>
          <p className={`text-xs ${subtitleColor} leading-none mt-1`}>
            Sistema Empresarial
          </p>
        </div>
      )}
    </div>
  );
};