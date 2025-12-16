'use client';

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import pt from './locales/pt.json';
import en from './locales/en.json';
import es from './locales/es.json';

export type LanguageCode = 'pt' | 'en' | 'es';

export interface Language {
  code: LanguageCode;
  name: string;
  flag: React.ElementType;
}

interface I18nContextType {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: string, args?: Record<string, string | number>) => string;
}

const translations: Record<LanguageCode, any> = { pt, en, es };

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<LanguageCode>('pt');

  useEffect(() => {
    const browserLang = navigator.language.split('-')[0] as LanguageCode;
    if (['pt', 'en', 'es'].includes(browserLang)) {
      setLanguage(browserLang);
    }
  }, []);

  const t = useCallback((key: string, args?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let result = translations[language];
    for (const k of keys) {
      result = result?.[k];
      if (result === undefined) {
        return key; // Return the key if translation is not found
      }
    }

    if (typeof result === 'string' && args) {
      return Object.entries(args).reduce((acc, [argKey, argValue]) => {
        return acc.replace(`{{${argKey}}}`, String(argValue));
      }, result);
    }

    return result ?? key;
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
