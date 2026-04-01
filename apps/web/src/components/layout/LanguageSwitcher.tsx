import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { isUiLocaleCode, UI_LOCALE_ENTRIES } from '../../i18n/ui-locales';
import { lifeOsApi } from '../../lib/api';
import { los } from '../../design/tokens';

type LangRow = { languageTag: string; uiSupported: boolean };

/**
 * Lists UI locales from `ui-locales.ts`, intersected with `GET /languages` when available
 * so the nav stays honest vs the server registry.
 */
export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const langs = useQuery({
    queryKey: ['languages'],
    queryFn: () => lifeOsApi.getLanguages(),
    staleTime: 60_000,
    retry: 1,
  });

  const options = useMemo(() => {
    const rows = langs.data?.languages as LangRow[] | undefined;
    if (!rows?.length) return [...UI_LOCALE_ENTRIES];
    const allowed = new Set(rows.filter((r) => r.uiSupported).map((r) => r.languageTag));
    const hit = UI_LOCALE_ENTRIES.filter((e) => allowed.has(e.code));
    return hit.length > 0 ? hit : [...UI_LOCALE_ENTRIES];
  }, [langs.data]);

  const value = useMemo(() => {
    const lng = i18n.resolvedLanguage ?? i18n.language;
    if (isUiLocaleCode(lng)) return lng;
    return 'en';
  }, [i18n.resolvedLanguage, i18n.language]);

  return (
    <label className={`flex items-center gap-2 text-xs ${los.textMuted}`}>
      <span className="sr-only">{t('nav.language')}</span>
      <select
        value={value}
        onChange={(e) => {
          void i18n.changeLanguage(e.target.value);
        }}
        className={`rounded-lg border border-white/10 bg-[#0F1624]/90 px-2 py-1 text-slate-200 ${los.focusRing}`}
        aria-label={t('nav.language')}
        disabled={langs.isLoading}
        aria-busy={langs.isLoading}
      >
        {options.map((e) => (
          <option key={e.code} value={e.code}>
            {e.label}
          </option>
        ))}
      </select>
    </label>
  );
}
