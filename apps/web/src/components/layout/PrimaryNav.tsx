import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router';
import { LifeOSLogoMark } from '../brand/LifeOSLogo';
import { LanguageSwitcher } from './LanguageSwitcher';
import { los } from '../../design/tokens';
import { lifeOsApi } from '../../lib/api';

const PRIMARY = [
  { to: '/', key: 'nav.brief' },
  { to: '/obligations', key: 'nav.obligations' },
  { to: '/capture', key: 'nav.capture' },
  { to: '/privacy', key: 'nav.privacy' },
  { to: '/settings', key: 'nav.settings' },
] as const;

const MORE = [
  { to: '/m', key: 'nav.mobile' },
  { to: '/notes', key: 'nav.notes' },
  { to: '/people', key: 'nav.people' },
  { to: '/events', key: 'nav.timeline' },
  { to: '/suggestions', key: 'nav.suggestions' },
  { to: '/voice', key: 'nav.voice' },
  { to: '/admin', key: 'nav.admin' },
  { to: '/me', key: 'nav.profile' },
  { to: '/profile/priority', key: 'nav.profilePriority' },
  { to: '/patterns', key: 'nav.patterns' },
  { to: '/places', key: 'nav.places' },
  { to: '/life', key: 'nav.lifeFlow' },
  { to: '/twin', key: 'nav.copilot' },
  { to: '/ecosystem', key: 'nav.ecosystem' },
  { to: '/tile', key: 'nav.tile' },
  { to: '/capabilities', key: 'nav.capabilities' },
  { to: '/domains', key: 'nav.domains' },
  { to: '/memory', key: 'nav.memory' },
  { to: '/documents', key: 'nav.documents' },
  { to: '/connectors', key: 'nav.connectors' },
  { to: '/security', key: 'nav.security' },
  { to: '/continuity', key: 'nav.continuity' },
] as const;

const EVERYONE_MORE = [
  { to: '/notes', key: 'nav.notes' },
  { to: '/suggestions', key: 'nav.suggestions' },
  { to: '/voice', key: 'nav.voice' },
  { to: '/places', key: 'nav.places' },
  { to: '/security', key: 'nav.security' },
  { to: '/continuity', key: 'nav.continuity' },
  { to: '/settings', key: 'nav.settings' },
] as const;

function linkClass({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return `${los.navActive} ${los.navActivePill} ${los.focusRing} text-sm`;
  }
  return `${los.navInactive} ${los.focusRing} rounded-lg px-2.5 py-1 text-sm`;
}

export function PrimaryNav() {
  const { t } = useTranslation();
  const settingsQ = useQuery({
    queryKey: ['settings'],
    queryFn: () => lifeOsApi.getSettings(),
    staleTime: 60_000,
  });
  const st = settingsQ.data?.settings as { everyoneModeEnabled?: boolean } | undefined;
  const everyoneMode = st?.everyoneModeEnabled !== false;
  const moreItems = everyoneMode ? EVERYONE_MORE : MORE;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <Link
          to="/"
          className={`flex items-center gap-2.5 text-lg ${los.focusRing} rounded-lg`}
        >
          <LifeOSLogoMark presentation className="shrink-0" />
          <span className={los.brandWordmarkNeon}>{t('common.lifeOs')}</span>
        </Link>
        <nav className="flex flex-wrap gap-1 sm:gap-0.5" aria-label="Primary">
          {PRIMARY.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
              {t(item.key)}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
        <LanguageSwitcher />
        <details className="group relative z-[60] [&_summary::-webkit-details-marker]:hidden">
          <summary
            className={`${los.navInactive} ${los.focusRing} cursor-pointer list-none rounded-lg px-2.5 py-1 text-sm marker:content-none`}
          >
            {t('nav.more')}
          </summary>
          <nav
            className="absolute end-0 top-full z-[60] mt-2 min-w-[13rem] overflow-hidden rounded-xl border border-white/10 bg-[#0F1624]/95 py-1 shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur-md"
            aria-label="More destinations"
          >
            {moreItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-300'
                      : 'text-slate-300 hover:bg-white/[0.04] hover:text-slate-100'
                  }`
                }
              >
                {t(item.key)}
              </NavLink>
            ))}
          </nav>
        </details>
      </div>
    </div>
  );
}
