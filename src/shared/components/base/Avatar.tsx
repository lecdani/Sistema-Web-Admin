import React from 'react';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`relative flex h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-md ${className}`}
        {...props}
      />
    );
  }
);

Avatar.displayName = 'Avatar';

export interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {}

export const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className = '', src, ...props }, ref) => {
    // No renderizar el img si src está vacío o es undefined
    if (!src) {
      return null;
    }
    
    return (
      <img
        ref={ref}
        src={src}
        className={`aspect-square h-full w-full object-cover ${className}`}
        {...props}
      />
    );
  }
);

AvatarImage.displayName = 'AvatarImage';

export interface AvatarFallbackProps extends React.HTMLAttributes<HTMLDivElement> {}

export const AvatarFallback = React.forwardRef<HTMLDivElement, AvatarFallbackProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold ${className}`}
        {...props}
      />
    );
  }
);

AvatarFallback.displayName = 'AvatarFallback';
