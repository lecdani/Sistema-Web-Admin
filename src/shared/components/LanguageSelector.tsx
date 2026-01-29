import React from 'react';
import { Globe } from 'lucide-react';
import { Button } from './base/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './base/DropdownMenu';
import { useLanguage } from '../hooks/useLanguage';
import { Language } from '../types';

export const LanguageSelector: React.FC = () => {
  const { language, changeLanguage, translate } = useLanguage();

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: 'es', label: translate('spanish'), flag: '🇪🇸' },
    { code: 'en', label: translate('english'), flag: '🇺🇸' }
  ];

  const currentLanguage = languages.find(lang => lang.code === language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2 hover:bg-blue-50 hover:text-blue-700"
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:block">
            {currentLanguage?.flag} {currentLanguage?.label}
          </span>
          <span className="sm:hidden">{currentLanguage?.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={`cursor-pointer ${
              language === lang.code ? 'bg-blue-50 text-blue-700' : ''
            }`}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};