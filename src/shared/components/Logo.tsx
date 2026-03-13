import React, { useState } from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
  variant?: 'light' | 'dark';
}

const sizeMap = {
  sm: { img: 'h-8 w-auto', text: 'text-lg' },
  md: { img: 'h-10 w-auto', text: 'text-xl' },
  lg: { img: 'h-12 w-auto', text: 'text-2xl' }
};

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  variant = 'light'
}) => {
  const [imgError, setImgError] = useState(false);
  const isLight = variant === 'light';
  const textColor = isLight ? 'text-white' : 'text-gray-900';
  const subtitleColor = isLight ? 'text-indigo-100' : 'text-gray-500';

  if (imgError) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className={`${sizeMap[size].img} min-w-[2rem] rounded-lg bg-gray-900 flex items-center justify-center px-2`}>
          <span className="font-bold text-white text-sm tracking-tight">∞</span>
        </div>
        {showText && (
          <div className="flex flex-col">
            <span className={`${sizeMap[size].text} font-bold ${textColor} leading-none`}>ETERNAL</span>
            <span className={`text-xs ${subtitleColor} leading-none mt-1`}>Sistema Empresarial</span>
          </div>
        )}
      </div>
    );
  }

  // En variant dark (sidebar/menú) el logo es blanco: fondo azul como el del avatar para que se vea
  const logoImg = (
    <img
      src="/logo-eternal.png"
      alt="ETERNAL"
      className={variant === 'dark' ? 'h-full w-auto max-h-full object-contain' : `${sizeMap[size].img} object-contain object-left`}
      onError={() => setImgError(true)}
    />
  );

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {variant === 'dark' ? (
        <div className={`rounded-lg bg-indigo-600 flex items-center justify-center p-1.5 flex-shrink-0 ${sizeMap[size].img}`}>
          {logoImg}
        </div>
      ) : (
        logoImg
      )}
      {showText && (
        <div className="flex flex-col">
          <span className={`${sizeMap[size].text} font-bold ${textColor} leading-none`}>ETERNAL</span>
          <span className={`text-xs ${subtitleColor} leading-none mt-1`}>Sistema Empresarial</span>
        </div>
      )}
    </div>
  );
};
