import { useState, useEffect, useCallback } from 'react';
import { Language } from '../types';
import { t } from '../utils/i18n';
import { getFromLocalStorage, setToLocalStorage } from '../services/database';

export const useLanguage = () => {
  const [language, setLanguage] = useState<Language>('es');
  const [isLoading, setIsLoading] = useState(true);

  // Cargar idioma guardado al montar el componente
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const settings = getFromLocalStorage('app-settings');
        if (settings && settings.language) {
          setLanguage(settings.language);
        } else {
          // Detectar idioma del navegador como fallback (solo en cliente)
          if (typeof window !== 'undefined' && navigator?.language) {
            const browserLang = navigator.language.startsWith('es') ? 'es' : 'en';
            setLanguage(browserLang);
          }
        }
      } catch (error) {
        console.error('Error cargando idioma:', error);
        setLanguage('es'); // Fallback a español
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();
  }, []);

  const changeLanguage = useCallback(async (newLanguage: Language) => {
    try {
      setLanguage(newLanguage);
      
      // Obtener configuración existente o crear nueva
      const existingSettings = getFromLocalStorage('app-settings') || {
        id: 'app-settings',
        theme: 'light',
        notifications: true
      };
      
      // Actualizar idioma
      const updatedSettings = {
        ...existingSettings,
        language: newLanguage
      };
      
      // Guardar en localStorage
      setToLocalStorage('app-settings', updatedSettings);
      console.log('✓ Idioma actualizado:', newLanguage);
    } catch (error) {
      console.error('Error guardando idioma:', error);
    }
  }, []);

  const translate = useCallback((key: string): string => {
    return t(key, language);
  }, [language]);

  return {
    language,
    changeLanguage,
    translate,
    isLoading
  };
};