import type { TFunction } from 'i18next';
import { ApiError } from './api';

function isLikelyNetworkFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error && /network|fetch|load failed|failed to fetch/i.test(err.message)) return true;
  return false;
}

/** Map stable API error codes to localized copy; fall back to message text. */
export function formatApiError(err: unknown, t: TFunction): string {
  if (isLikelyNetworkFailure(err)) {
    return t('errors.apiUnreachable');
  }
  if (err instanceof ApiError) {
    // 502/503/504: proxy or gateway (typical when the API process is not running).
    if (err.status >= 502 || err.status === 0) {
      return t('errors.apiUnreachable');
    }
    const key = `errors.${err.code}`;
    const translated = t(key);
    if (translated && translated !== key) return translated;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return t('errors.generic');
}
