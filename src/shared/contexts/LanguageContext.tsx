'use client';

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { Language } from '../types';
import { t } from '../utils/i18n';
import { getFromLocalStorage, setToLocalStorage } from '../services/database';

const LOCALE_MAP = { es: 'es-ES', en: 'en-US' } as const;

interface LanguageContextValue {
  language: Language;
  locale: string;
  setLanguage: (lang: Language) => void;
  changeLanguage: (lang: Language) => void;
  translate: (key: string) => string;
  isLoading: boolean;
}

const defaultValue: LanguageContextValue = {
  language: 'es',
  locale: 'es-ES',
  setLanguage: () => {},
  changeLanguage: () => {},
  translate: (key: string) => key,
  isLoading: true
};

export const LanguageContext = createContext<LanguageContextValue>(defaultValue);

const STORAGE_KEY = 'app-settings';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('es');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }
    try {
      const settings = getFromLocalStorage(STORAGE_KEY);
      if (settings && (settings as any).language === 'en') {
        setLanguageState('en');
      } else if (settings && (settings as any).language === 'es') {
        setLanguageState('es');
      } else if (navigator?.language?.startsWith('en')) {
        setLanguageState('en');
      } else {
        setLanguageState('es');
      }
    } catch {
      setLanguageState('es');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const changeLanguage = useCallback((newLanguage: Language) => {
    setLanguageState(newLanguage);
    try {
      if (typeof window !== 'undefined') {
        const existing = getFromLocalStorage(STORAGE_KEY) as Record<string, unknown> | null;
        const updated = {
          ...(existing || { id: STORAGE_KEY, theme: 'light', notifications: true }),
          language: newLanguage
        };
        setToLocalStorage(STORAGE_KEY, updated);
        if (document.documentElement) document.documentElement.lang = newLanguage;
      }
    } catch (e) {
      console.error('Error saving language', e);
    }
  }, []);

  const translate = useCallback((key: string): string => t(key, language), [language]);

  useEffect(() => {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = language;
    }
  }, [language]);

  const value: LanguageContextValue = {
    language,
    locale: LOCALE_MAP[language],
    setLanguage: changeLanguage,
    changeLanguage,
    translate,
    isLoading
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
