import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { lifeOsApi } from '../lib/api';
import { los } from '../design/tokens';

const MODES = ['WORK', 'STUDY', 'ADMIN', 'PERSONAL', 'MIXED', 'TRAVEL', 'HEALTH_RECORD_REVIEW'] as const;
const DENSITY = ['MINIMAL', 'BALANCED', 'DETAILED'] as const;
const REMINDER = ['CALM', 'DIRECT', 'CHECKLIST', 'SUMMARY'] as const;
const PRIV = ['STANDARD', 'HIGH', 'STRICT'] as const;

export default function ProfilePriority() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['me-profile'], queryFn: () => lifeOsApi.getProfile() });
  const modeQ = useQuery({ queryKey: ['profile-mode'], queryFn: () => lifeOsApi.getProfileMode() });

  const [displayName, setDisplayName] = useState('');
  const [density, setDensity] = useState<string>('BALANCED');
  const [reminder, setReminder] = useState<string>('CALM');
  const [lifeDefault, setLifeDefault] = useState<string>('MIXED');
  const [privacy, setPrivacy] = useState<string>('STANDARD');
  const [escalationH, setEscalationH] = useState<string>('');
  const [weights, setWeights] = useState({ work: 1, study: 1, admin: 1, personal: 1, health_tracking: 1 });

  const p = q.data?.profile as Record<string, unknown> | undefined;

  useEffect(() => {
    if (!p) return;
    setDisplayName(String(p.displayName ?? ''));
    setDensity(String(p.preferredBriefDensity ?? 'BALANCED'));
    setReminder(String(p.uprReminderStyle ?? 'CALM'));
    setLifeDefault(String(p.mainLifeModeDefault ?? 'MIXED'));
    setPrivacy(String(p.uprPrivacySensitivity ?? 'STANDARD'));
    setEscalationH(
      p.preferredEscalationWindowHours != null ? String(p.preferredEscalationWindowHours) : '',
    );
    try {
      const j = JSON.parse(String(p.priorityDomainWeightsJson ?? '{}')) as Record<string, number>;
      setWeights({
        work: j.work ?? 1,
        study: j.study ?? 1,
        admin: j.admin ?? 1,
        personal: j.personal ?? 1,
        health_tracking: j.health_tracking ?? 1,
      });
    } catch {
      /* keep defaults */
    }
  }, [p]);

  const save = useMutation({
    mutationFn: () =>
      lifeOsApi.patchProfile({
        displayName: displayName.trim() || null,
        preferredBriefDensity: density,
        uprReminderStyle: reminder,
        mainLifeModeDefault: lifeDefault,
        uprPrivacySensitivity: privacy,
        preferredEscalationWindowHours:
          escalationH.trim() === '' ? null : Math.min(168, Math.max(1, Number(escalationH))),
        priorityDomainWeightsJson: JSON.stringify(weights),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me-profile'] });
      void qc.invalidateQueries({ queryKey: ['profile-adaptation'] });
    },
  });

  const setMode = useMutation({
    mutationFn: (m: string) =>
      lifeOsApi.postProfileMode({ activeMode: m, durationHours: 8 }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['profile-mode'] }),
  });

  const clearMode = useMutation({
    mutationFn: () => lifeOsApi.postProfileModeClear(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['profile-mode'] }),
  });

  const resetInference = useMutation({
    mutationFn: () => lifeOsApi.postProfileResetInference(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['profile-adaptation'] }),
  });

  if (q.isLoading) return <p className={los.textMuted}>Loading…</p>;
  if (q.isError) return <p className="text-rose-300">{(q.error as Error).message}</p>;

  return (
    <div className={`mx-auto max-w-xl space-y-8 ${los.textPrimary}`}>
      <div>
        <h1 className="text-xl font-semibold">Profile & priority</h1>
        <p className={`mt-1 text-sm ${los.textSecondary}`}>
          Declared preferences override inference. Rank and reminders adapt; evidence and deadlines do not.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className={`text-sm font-medium ${los.textSecondary}`}>Active focus mode</h2>
        {modeQ.data ? (
          <p className={`text-sm ${los.textMuted}`}>
            Now: <span className="text-slate-200">{modeQ.data.mode}</span> ({modeQ.data.source})
            {modeQ.data.endsAt ? ` · until ${new Date(modeQ.data.endsAt).toLocaleString()}` : ''}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={`rounded-lg border border-white/15 px-3 py-1.5 text-xs ${los.focusRing}`}
              onClick={() => setMode.mutate(m)}
              disabled={setMode.isPending}
            >
              Set {m}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`text-sm ${los.accentLink}`}
          onClick={() => clearMode.mutate()}
          disabled={clearMode.isPending}
        >
          Clear manual mode
        </button>
      </section>

      <section className="space-y-3">
        <label className={`flex flex-col gap-1 text-sm`}>
          <span className={los.textMuted}>Display name</span>
          <input
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>

        <label className={`flex flex-col gap-1 text-sm`}>
          <span className={los.textMuted}>Brief density</span>
          <select
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            value={density}
            onChange={(e) => setDensity(e.target.value)}
          >
            {DENSITY.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className={`flex flex-col gap-1 text-sm`}>
          <span className={los.textMuted}>Reminder style</span>
          <select
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            value={reminder}
            onChange={(e) => setReminder(e.target.value)}
          >
            {REMINDER.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className={`flex flex-col gap-1 text-sm`}>
          <span className={los.textMuted}>Default life mode</span>
          <select
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            value={lifeDefault}
            onChange={(e) => setLifeDefault(e.target.value)}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className={`flex flex-col gap-1 text-sm`}>
          <span className={los.textMuted}>Adaptation / inference scope</span>
          <select
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value)}
          >
            {PRIV.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>

        <label className={`flex flex-col gap-1 text-sm`}>
          <span className={los.textMuted}>Escalation window (hours before due)</span>
          <input
            type="number"
            min={1}
            max={168}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            placeholder="optional"
            value={escalationH}
            onChange={(e) => setEscalationH(e.target.value)}
          />
        </label>
      </section>

      <section className="space-y-2">
        <h2 className={`text-sm font-medium ${los.textSecondary}`}>Domain weights (0.25–2)</h2>
        <p className={`text-xs ${los.textMuted}`}>
          Bias ranking only — never hides hard deadlines. Health is tracking / documents, not diagnosis.
        </p>
        {(Object.keys(weights) as (keyof typeof weights)[]).map((k) => (
          <label key={k} className="flex items-center justify-between gap-2 text-sm">
            <span>{k}</span>
            <input
              type="number"
              step={0.05}
              min={0.25}
              max={2}
              className="w-24 rounded border border-white/10 bg-white/5 px-2 py-1"
              value={weights[k]}
              onChange={(e) =>
                setWeights((w) => ({ ...w, [k]: Number(e.target.value) || 1 }))
              }
            />
          </label>
        ))}
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          Save profile
        </button>
        <button
          type="button"
          className="rounded-lg border border-amber-400/40 px-4 py-2 text-sm text-amber-200"
          onClick={() => {
            if (confirm('Clear all inferred signals and states? Declared settings stay.')) resetInference.mutate();
          }}
          disabled={resetInference.isPending}
        >
          Reset inference
        </button>
        <Link to="/profile/adaptation" className={`self-center text-sm ${los.accentLink}`}>
          Adaptation inspector →
        </Link>
      </div>

      {save.isError ? <p className="text-rose-300">{(save.error as Error).message}</p> : null}
    </div>
  );
}
