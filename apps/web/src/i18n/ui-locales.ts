/**
 * Locales available in the web shell (nav Language switcher).
 * Must match `resources` in `config.ts`. Tier-1 Asia + global aligns with language registry.
 */
export type UiLocaleCode =
  | 'en'
  | 'ar'
  | 'ja'
  | 'ko'
  | 'th'
  | 'vi'
  | 'zh-Hans'
  | 'zh-Hant'
  | 'km'
  | 'lo';

export type UiLocaleEntry = {
  code: UiLocaleCode;
  /** Shown in the dropdown */
  label: string;
  rtl?: boolean;
};

export const UI_LOCALE_ENTRIES: readonly UiLocaleEntry[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية', rtl: true },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'th', label: 'ไทย' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'zh-Hans', label: '简体中文' },
  { code: 'zh-Hant', label: '繁體中文' },
  { code: 'km', label: 'ភាសាខ្មែរ' },
  { code: 'lo', label: 'ລາວ' },
] as const;

export const UI_LOCALE_CODES: ReadonlySet<string> = new Set(UI_LOCALE_ENTRIES.map((e) => e.code));

export function isUiLocaleCode(x: string): x is UiLocaleCode {
  return UI_LOCALE_CODES.has(x);
}

export function uiLocaleEntry(code: string): UiLocaleEntry | undefined {
  return UI_LOCALE_ENTRIES.find((e) => e.code === code);
}
