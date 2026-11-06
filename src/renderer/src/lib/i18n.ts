import { useCallback } from 'react';
import { translate } from '@shared/i18n';
import { useAppStore } from '../state/store';

export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const locale = useAppStore((s) => s.settings?.locale ?? 'en');
  return useCallback((key: string, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);
}

export function useLocale(): string {
  return useAppStore((s) => s.settings?.locale ?? 'en');
}
