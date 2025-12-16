'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BrazilFlag, UKFlag, SpainFlag } from '@/components/icons/flags';
import { Languages } from 'lucide-react';
import { useI18n } from '@/i18n/i18n-provider';
import type { Language } from '@/i18n/i18n-provider';

const languageOptions: Language[] = [
  { code: 'pt', name: 'Português', flag: BrazilFlag },
  { code: 'en', name: 'English', flag: UKFlag },
  { code: 'es', name: 'Español', flag: SpainFlag },
];

export default function LanguageSwitcher() {
  const { language, setLanguage } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Languages className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Change language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languageOptions.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className="flex items-center gap-2"
          >
            <lang.flag className="h-4 w-4" />
            <span>{lang.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
