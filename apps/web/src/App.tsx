import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, Route, Routes } from 'react-router';
import { EveryoneAdvancedRouteLayout } from './components/everyone/EveryoneAdvancedRouteLayout';
import { PrimaryNav } from './components/layout/PrimaryNav';
import { los } from './design/tokens';

const HomeBrief = lazy(() => import('./pages/HomeBrief'));
const Obligations = lazy(() => import('./pages/Obligations'));
const Suggestions = lazy(() => import('./pages/Suggestions'));
const Notes = lazy(() => import('./pages/Notes'));
const People = lazy(() => import('./pages/People'));
const PersonDetail = lazy(() => import('./pages/PersonDetail'));
const Events = lazy(() => import('./pages/Events'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const Admin = lazy(() => import('./pages/Admin'));
const AdminRecordDetail = lazy(() => import('./pages/AdminRecordDetail'));
const VoiceCapture = lazy(() => import('./pages/VoiceCapture'));
const MeProfile = lazy(() => import('./pages/MeProfile'));
const Patterns = lazy(() => import('./pages/Patterns'));
const Places = lazy(() => import('./pages/Places'));
const LifeFlow = lazy(() => import('./pages/LifeFlow'));
const Twin = lazy(() => import('./pages/Twin'));
const Ecosystem = lazy(() => import('./pages/Ecosystem'));
const TileSimulator = lazy(() => import('./pages/TileSimulator'));
const Settings = lazy(() => import('./pages/Settings'));
const SecurityCenter = lazy(() => import('./pages/SecurityCenter'));
const ContinuityCenter = lazy(() => import('./pages/ContinuityCenter'));
const Capabilities = lazy(() => import('./pages/Capabilities'));
const Domains = lazy(() => import('./pages/Domains'));
const DomainDetail = lazy(() => import('./pages/DomainDetail'));
const Memory = lazy(() => import('./pages/Memory'));
const MemoryDetail = lazy(() => import('./pages/MemoryDetail'));
const Capture = lazy(() => import('./pages/Capture'));
const Documents = lazy(() => import('./pages/Documents'));
const DocumentDetail = lazy(() => import('./pages/DocumentDetail'));
const Connectors = lazy(() => import('./pages/Connectors'));
const ConnectorDetail = lazy(() => import('./pages/ConnectorDetail'));
const Privacy = lazy(() => import('./pages/Privacy'));
const EveryoneOnboarding = lazy(() => import('./pages/EveryoneOnboarding'));
const ProfilePriority = lazy(() => import('./pages/ProfilePriority'));
const AdaptationInspector = lazy(() => import('./pages/AdaptationInspector'));
const MobileShell = lazy(() => import('./mobile/MobileShell').then((m) => ({ default: m.MobileShell })));
const MobileDailyBrief = lazy(() => import('./mobile/screens/MobileDailyBrief'));
const NotificationInbox = lazy(() => import('./mobile/screens/NotificationInbox'));
const NotificationDetail = lazy(() => import('./mobile/screens/NotificationDetail'));
const QuickCaptureSheet = lazy(() => import('./mobile/screens/QuickCaptureSheet'));
const MobileSettingsNotifications = lazy(() => import('./mobile/screens/MobileSettingsNotifications'));
const MobileObligationDetail = lazy(() => import('./mobile/screens/MobileObligationDetail'));

function Layout() {
  const { t } = useTranslation();
  return (
    <div className={`relative min-h-screen ${los.surface}`}>
      <div className={`pointer-events-none fixed inset-0 -z-10 ${los.atmosphere}`} aria-hidden />
      <div className="relative flex min-h-screen flex-col">
        <header className={`px-4 py-3 sm:px-6 ${los.shellBar}`}>
          <PrimaryNav />
        </header>
        <main className="relative z-0 mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <Suspense fallback={<p className={los.textMuted}>{t('common.loading')}</p>}>
            <Outlet />
          </Suspense>
        </main>
        <footer className={`px-4 py-2.5 ${los.trustedBar}`}>
          <p className="mx-auto flex max-w-6xl items-center justify-center gap-2">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.65)]"
              aria-hidden
            />
            <span>{t('shell.trustedLayer')}</span>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="m"
        element={
          <Suspense fallback={<p className="p-6 text-slate-400">Loading…</p>}>
            <MobileShell />
          </Suspense>
        }
      >
        <Route
          index
          element={
            <Suspense fallback={<p className="text-slate-400">Loading…</p>}>
              <MobileDailyBrief />
            </Suspense>
          }
        />
        <Route
          path="inbox"
          element={
            <Suspense fallback={<p className="text-slate-400">Loading…</p>}>
              <NotificationInbox />
            </Suspense>
          }
        />
        <Route
          path="inbox/:id"
          element={
            <Suspense fallback={<p className="text-slate-400">Loading…</p>}>
              <NotificationDetail />
            </Suspense>
          }
        />
        <Route
          path="capture"
          element={
            <Suspense fallback={<p className="text-slate-400">Loading…</p>}>
              <QuickCaptureSheet />
            </Suspense>
          }
        />
        <Route
          path="settings/notifications"
          element={
            <Suspense fallback={<p className="text-slate-400">Loading…</p>}>
              <MobileSettingsNotifications />
            </Suspense>
          }
        />
        <Route
          path="obligations/:id"
          element={
            <Suspense fallback={<p className="text-slate-400">Loading…</p>}>
              <MobileObligationDetail />
            </Suspense>
          }
        />
      </Route>
      <Route element={<Layout />}>
        <Route index element={<HomeBrief />} />
        <Route path="obligations" element={<Obligations />} />
        <Route path="suggestions" element={<Suggestions />} />
        <Route path="capture" element={<Capture />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="welcome" element={<EveryoneOnboarding />} />
        <Route path="notes" element={<Notes />} />
        <Route path="voice" element={<VoiceCapture />} />
        <Route path="places" element={<Places />} />
        <Route path="settings" element={<Settings />} />
        <Route path="security" element={<SecurityCenter />} />
        <Route path="continuity" element={<ContinuityCenter />} />
        <Route element={<EveryoneAdvancedRouteLayout />}>
          <Route path="profile/priority" element={<ProfilePriority />} />
          <Route path="profile/adaptation" element={<AdaptationInspector />} />
          <Route path="people" element={<People />} />
          <Route path="people/:id" element={<PersonDetail />} />
          <Route path="events" element={<Events />} />
          <Route path="events/:id" element={<EventDetail />} />
          <Route path="admin" element={<Admin />} />
          <Route path="admin/:id" element={<AdminRecordDetail />} />
          <Route path="me" element={<MeProfile />} />
          <Route path="patterns" element={<Patterns />} />
          <Route path="life" element={<LifeFlow />} />
          <Route path="twin" element={<Twin />} />
          <Route path="ecosystem" element={<Ecosystem />} />
          <Route path="tile" element={<TileSimulator />} />
          <Route path="capabilities" element={<Capabilities />} />
          <Route path="domains" element={<Domains />} />
          <Route path="domains/:domainKey" element={<DomainDetail />} />
          <Route path="memory" element={<Memory />} />
          <Route path="memory/:memoryId" element={<MemoryDetail />} />
          <Route path="documents" element={<Documents />} />
          <Route path="documents/:id" element={<DocumentDetail />} />
          <Route path="connectors" element={<Connectors />} />
          <Route path="connectors/:id" element={<ConnectorDetail />} />
        </Route>
      </Route>
    </Routes>
  );
}
