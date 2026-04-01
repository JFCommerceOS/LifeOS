import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageHeader } from '../components/layout/PageHeader';
import { los } from '../design/tokens';
import { lifeOsApi } from '../lib/api';

export default function SecurityCenter() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const meQ = useQuery({
    queryKey: ['identity', 'me'],
    queryFn: () => lifeOsApi.getIdentityMe(),
  });

  const policyQ = useQuery({
    queryKey: ['security', 'policy'],
    queryFn: () => lifeOsApi.getSecurityPolicyBundle(),
  });

  const devicesQ = useQuery({
    queryKey: ['devices'],
    queryFn: () => lifeOsApi.getDevices(),
  });

  const sessionsQ = useQuery({
    queryKey: ['sessions'],
    queryFn: () => lifeOsApi.getSessions(),
  });

  const auditQ = useQuery({
    queryKey: ['security', 'audit'],
    queryFn: () => lifeOsApi.getSecurityAuditLogs(),
  });

  const bootstrapM = useMutation({
    mutationFn: () => lifeOsApi.postIdentityBootstrap(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['identity'] });
      void qc.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  const patchPolicyM = useMutation({
    mutationFn: (body: object) => lifeOsApi.patchSecurityPolicyBundle(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['security', 'policy'] }),
  });

  const exportM = useMutation({
    mutationFn: () =>
      lifeOsApi.postSecurityExport({
        includeSensitive: false,
        encrypt: true,
        format: 'json',
      }),
  });

  const settings = policyQ.data?.settings as
    | {
        healthDomainSurfacePolicy?: string;
        financeDomainSurfacePolicy?: string;
        watchSensitiveDetailOptIn?: boolean;
      }
    | undefined;

  return (
    <div className={los.page}>
      <PageHeader title={t('security.title')} tagline={t('security.subtitle')} />

      <section className={`mb-8 rounded-xl border border-white/10 bg-[#0F1624]/60 p-6`}>
        <h2 className="text-lg font-semibold text-slate-100">{t('security.account')}</h2>
        <p className={`mt-2 text-sm ${los.textSecondary}`}>
          {t('security.accountHint')}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className={`rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 ${los.focusRing}`}
            onClick={() => bootstrapM.mutate()}
            disabled={bootstrapM.isPending}
          >
            {t('security.bootstrapSession')}
          </button>
          <button
            type="button"
            className={`rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 ${los.focusRing}`}
            onClick={() => {
              lifeOsApi.clearSessionToken();
              void qc.invalidateQueries();
            }}
          >
            {t('security.clearSession')}
          </button>
        </div>
        {meQ.data?.user ? (
          <pre className={`mt-4 max-h-40 overflow-auto rounded-lg bg-black/30 p-3 text-xs ${los.textMuted}`}>
            {JSON.stringify(meQ.data.user, null, 2)}
          </pre>
        ) : null}
      </section>

      <section className={`mb-8 rounded-xl border border-white/10 bg-[#0F1624]/60 p-6`}>
        <h2 className="text-lg font-semibold text-slate-100">{t('security.domainPolicy')}</h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
          <label className={`flex flex-col gap-1 text-sm ${los.textSecondary}`}>
            {t('security.healthMode')}
            <select
              className="rounded-lg border border-white/15 bg-[#0c121c] px-3 py-2 text-slate-100"
              value={settings?.healthDomainSurfacePolicy ?? 'strict'}
              onChange={(e) =>
                patchPolicyM.mutate({ healthDomainSurfacePolicy: e.target.value as 'strict' | 'standard' })
              }
              disabled={patchPolicyM.isPending}
            >
              <option value="strict">strict</option>
              <option value="standard">standard</option>
            </select>
          </label>
          <label className={`flex flex-col gap-1 text-sm ${los.textSecondary}`}>
            {t('security.financeMode')}
            <select
              className="rounded-lg border border-white/15 bg-[#0c121c] px-3 py-2 text-slate-100"
              value={settings?.financeDomainSurfacePolicy ?? 'strict'}
              onChange={(e) =>
                patchPolicyM.mutate({ financeDomainSurfacePolicy: e.target.value as 'strict' | 'standard' })
              }
              disabled={patchPolicyM.isPending}
            >
              <option value="strict">strict</option>
              <option value="standard">standard</option>
            </select>
          </label>
          <label className={`flex items-center gap-2 text-sm ${los.textSecondary}`}>
            <input
              type="checkbox"
              checked={settings?.watchSensitiveDetailOptIn ?? false}
              onChange={(e) => patchPolicyM.mutate({ watchSensitiveDetailOptIn: e.target.checked })}
              disabled={patchPolicyM.isPending}
            />
            {t('security.watchSensitiveOptIn')}
          </label>
        </div>
      </section>

      <section className={`mb-8 rounded-xl border border-white/10 bg-[#0F1624]/60 p-6`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{t('security.devices')}</h2>
            <p className={`mt-1 text-sm ${los.textSecondary}`}>{t('security.devicesHint')}</p>
          </div>
          <Link className={`text-sm ${los.accentLink}`} to="/ecosystem">
            {t('security.openEcosystem')}
          </Link>
        </div>
        <ul className="mt-4 space-y-2">
          {(devicesQ.data?.data as { id: string; label: string; trustStatus?: string }[] | undefined)?.map(
            (d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm"
              >
                <span className="text-slate-200">{d.label}</span>
                <span className={los.textMuted}>{d.trustStatus ?? '—'}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`text-xs ${los.accentLink}`}
                    onClick={() => lifeOsApi.patchDeviceTrust(d.id, { trustStatus: 'TRUSTED' })}
                  >
                    Trust
                  </button>
                  <button
                    type="button"
                    className="text-xs text-rose-300/90"
                    onClick={() => lifeOsApi.postDeviceRevoke(d.id).then(() => qc.invalidateQueries({ queryKey: ['devices'] }))}
                  >
                    Revoke
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      </section>

      <section className={`mb-8 rounded-xl border border-white/10 bg-[#0F1624]/60 p-6`}>
        <h2 className="text-lg font-semibold text-slate-100">{t('security.sessions')}</h2>
        <ul className="mt-4 space-y-2">
          {(sessionsQ.data?.data as { id: string; issuedAt: string }[] | undefined)?.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs text-slate-400">{s.id.slice(0, 12)}…</span>
              <button
                type="button"
                className="text-xs text-rose-300/90"
                onClick={() =>
                  lifeOsApi.postSessionsRevoke(s.id).then(() => qc.invalidateQueries({ queryKey: ['sessions'] }))
                }
              >
                {t('security.revokeSession')}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className={`mb-8 rounded-xl border border-white/10 bg-[#0F1624]/60 p-6`}>
        <h2 className="text-lg font-semibold text-slate-100">{t('security.export')}</h2>
        <p className={`mt-2 text-sm ${los.textSecondary}`}>{t('security.exportHint')}</p>
        <button
          type="button"
          className={`mt-4 rounded-lg bg-cyan-500/90 px-4 py-2 text-sm font-medium text-slate-950 ${los.focusRing}`}
          onClick={() => exportM.mutate()}
          disabled={exportM.isPending}
        >
          {t('security.runEncryptedExport')}
        </button>
        {exportM.isSuccess ? (
          <p className={`mt-3 text-sm ${los.textMuted}`}>{JSON.stringify(exportM.data?.job)}</p>
        ) : null}
      </section>

      <section className={`rounded-xl border border-white/10 bg-[#0F1624]/60 p-6`}>
        <h2 className="text-lg font-semibold text-slate-100">{t('security.audit')}</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {(auditQ.data?.data as { eventType: string; eventSummary: string; createdAt: string }[] | undefined)?.map(
            (a, i) => (
              <li key={i} className="border-b border-white/5 pb-2">
                <span className="text-slate-300">{a.eventType}</span>
                <span className={`ms-2 ${los.textMuted}`}>{a.eventSummary}</span>
                <span className={`ms-2 text-xs ${los.textMuted}`}>{a.createdAt}</span>
              </li>
            ),
          )}
        </ul>
      </section>
    </div>
  );
}
