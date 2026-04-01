import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { los } from '../design/tokens';

function mobileNavClass({ isActive }: { isActive: boolean }) {
  if (isActive) return `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-cyan-300 ${los.focusRing} rounded-lg`;
  return `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-slate-400 ${los.focusRing} rounded-lg`;
}

export function MobileShell() {
  const { t } = useTranslation();
  return (
    <div className={`relative min-h-screen ${los.surface} pb-[4.5rem]`}>
      <div className={`pointer-events-none fixed inset-0 -z-10 ${los.atmosphere}`} aria-hidden />
      <header className={`sticky top-0 z-10 px-4 py-3 ${los.shellBar}`}>
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <h1 className={`text-sm font-medium ${los.textSecondary}`}>{t('common.lifeOs')}</h1>
          <NavLink to="/" className={`text-xs ${los.accentLink} ${los.focusRing} rounded-md px-1`}>
            {t('mobile.openDesktop')}
          </NavLink>
        </div>
      </header>
      <main className="relative z-0 mx-auto w-full max-w-lg px-4 py-4">
        <Outlet />
      </main>
      <nav
        className={`fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 px-2 py-1 ${los.shellBar}`}
        aria-label="Mobile"
      >
        <div className="mx-auto flex max-w-lg justify-between">
          <NavLink to="/m" end className={mobileNavClass}>
            <span className="text-lg" aria-hidden>
              ◉
            </span>
            {t('nav.brief')}
          </NavLink>
          <NavLink to="/m/inbox" className={mobileNavClass}>
            <span className="text-lg" aria-hidden>
              ✉
            </span>
            {t('mobile.inboxTitle')}
          </NavLink>
          <NavLink to="/m/capture" className={mobileNavClass}>
            <span className="text-lg" aria-hidden>
              +
            </span>
            {t('nav.capture')}
          </NavLink>
          <NavLink to="/m/settings/notifications" className={mobileNavClass}>
            <span className="text-lg" aria-hidden>
              ⚙
            </span>
            {t('nav.settings')}
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
