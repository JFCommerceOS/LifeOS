import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/** Bind react-i18next once; repeated `use()` stacks duplicate 3rd-party plugins (e.g. Vite HMR). */
let didBindReactI18next = false;
import ar from './locales/ar.json';
import en from './locales/en.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import th from './locales/th.json';
import vi from './locales/vi.json';
import zhHans from './locales/zh-Hans.json';
import zhHant from './locales/zh-Hant.json';
import km from './locales/km.json';
import lo from './locales/lo.json';
import { UI_LOCALE_ENTRIES, isUiLocaleCode, uiLocaleEntry } from './ui-locales';

export const LOCALE_STORAGE_KEY = 'life-os:locale';

const resources: Record<string, { translation: typeof en }> = {
  en: { translation: en },
  ar: { translation: ar as unknown as typeof en },
  ja: { translation: ja as unknown as typeof en },
  ko: { translation: ko as unknown as typeof en },
  th: { translation: th as unknown as typeof en },
  vi: { translation: vi as unknown as typeof en },
  'zh-Hans': { translation: zhHans as unknown as typeof en },
  'zh-Hant': { translation: zhHant as unknown as typeof en },
  km: { translation: km as unknown as typeof en },
  lo: { translation: lo as unknown as typeof en },
};

function readStoredLocale(): string {
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (v && isUiLocaleCode(v)) return v;
  } catch {
    /* ignore */
  }
  return 'en';
}

function applyDocumentLocale(lng: string): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lng;
  const rtl = uiLocaleEntry(lng)?.rtl ?? false;
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
}

export async function initI18n(): Promise<void> {
  if (i18n.isInitialized) return;

  if (!didBindReactI18next) {
    i18n.use(initReactI18next);
    didBindReactI18next = true;
  }

  const lng = readStoredLocale();
  applyDocumentLocale(lng);

  await i18n.init({
    resources,
    lng,
    fallbackLng: 'en',
    supportedLngs: UI_LOCALE_ENTRIES.map((e) => e.code),
    // Avoid adding a bare `zh` parent for `zh-Hans` / `zh-Hant` (not in supportedLngs → noisy + brittle resolution).
    load: 'currentOnly',
    // `nonExplicitSupportedLngs: true` breaks lookup for `zh-Hans` / `zh-Hant` (nested keys resolve as missing).
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

  i18n.on('languageChanged', (next) => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    applyDocumentLocale(next);
  });
}

export { i18n };
