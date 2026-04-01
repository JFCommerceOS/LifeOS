import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation } from 'react-router';
import { los } from '../../design/tokens';
import {
  everyoneAdvancedGateKind,
  everyoneGateStorageKey,
  type EveryoneGateKind,
} from '../../lib/everyone-advanced-gate';
import { lifeOsApi } from '../../lib/api';

function gateMessageKeys(kind: EveryoneGateKind): { title: string; body: string } {
  const base = `everyoneGate.kinds.${kind}`;
  return { title: `${base}.title`, body: `${base}.body` };
}

export function EveryoneAdvancedRouteLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const kind = everyoneAdvancedGateKind(location.pathname);

  const settingsQ = useQuery({
    queryKey: ['settings'],
    queryFn: () => lifeOsApi.getSettings(),
    staleTime: 60_000,
  });

  const everyoneMode =
    (settingsQ.data?.settings as { everyoneModeEnabled?: boolean } | undefined)
      ?.everyoneModeEnabled !== false;

  const storageKey = kind ? everyoneGateStorageKey(kind) : '';
  const [bump, setBump] = useState(0);

  const dismissed = useMemo(() => {
    if (!storageKey) return true;
    try {
      return sessionStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  }, [storageKey, location.pathname, bump]);

  const showGate = Boolean(everyoneMode && kind && !dismissed);
  const keys = kind ? gateMessageKeys(kind) : null;

  const acknowledge = () => {
    if (!storageKey) return;
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      /* private mode / quota */
    }
    setBump((n) => n + 1);
  };

  return (
    <>
      {showGate && keys ? (
        <div
          role="region"
          aria-labelledby="everyone-gate-heading"
          className={`mb-8 rounded-xl border border-cyan-500/25 bg-gradient-to-br from-[#0c1522] to-[#0a1220] px-4 py-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] sm:px-6`}
        >
          <p className={`text-xs font-medium uppercase tracking-wide ${los.accent}`}>
            {t('everyoneGate.kicker')}
          </p>
          <h2
            id="everyone-gate-heading"
            className="mt-2 text-lg font-semibold leading-snug text-slate-50 sm:text-xl"
          >
            {t(keys.title)}
          </h2>
          <p className={`mt-3 max-w-2xl text-[15px] leading-relaxed ${los.textSecondary}`}>
            {t(keys.body)}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={`rounded-lg bg-cyan-500/90 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 ${los.focusRing}`}
              onClick={acknowledge}
            >
              {t('everyoneGate.continue')}
            </button>
            <Link
              to="/"
              className={`text-sm font-medium ${los.accentLink}`}
            >
              {t('everyoneGate.backBrief')}
            </Link>
            <Link
              to="/welcome"
              className={`text-sm ${los.textMuted} underline decoration-white/20 underline-offset-4 hover:text-slate-200`}
            >
              {t('everyoneGate.reviewWelcome')}
            </Link>
            <Link
              to="/settings"
              className={`text-sm ${los.textMuted} underline decoration-white/20 underline-offset-4 hover:text-slate-200`}
            >
              {t('everyoneGate.settingsLink')}
            </Link>
          </div>
        </div>
      ) : null}
      <Outlet />
    </>
  );
}
