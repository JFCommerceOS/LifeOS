import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { lifeOsApi } from '../lib/api';

export default function Ecosystem() {
  const qc = useQueryClient();
  const manifest = useQuery({ queryKey: ['ecosystem-manifest'], queryFn: () => lifeOsApi.getEcosystemManifest() });
  const devices = useQuery({ queryKey: ['devices'], queryFn: () => lifeOsApi.getDevices() });
  const watchPreview = useQuery({ queryKey: ['companion-watch'], queryFn: () => lifeOsApi.getCompanionWatch() });
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => lifeOsApi.getSettings() });

  const patchSettings = useMutation({
    mutationFn: (body: object) => lifeOsApi.patchSettings(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
      void qc.invalidateQueries({ queryKey: ['ecosystem-manifest'] });
    },
  });

  const register = useMutation({
    mutationFn: () =>
      lifeOsApi.postDeviceRegister({
        clientDeviceId,
        label: label || 'This browser',
        role,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['devices'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => lifeOsApi.deleteDevice(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['devices'] }),
  });

  const [clientDeviceId] = useState(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `dev-${Date.now()}`,
  );
  const [label, setLabel] = useState('');
  const [role, setRole] = useState<'phone' | 'watch' | 'accessory' | 'private_node'>('phone');

  const st = settings.data?.settings as { deviceSyncOptIn?: boolean } | undefined;

  const shells = useMemo(() => {
    const m = manifest.data as { shells?: Record<string, { ui?: string; boundaries?: string }> } | undefined;
    return m?.shells;
  }, [manifest.data]);

  if (manifest.isLoading || devices.isLoading) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-semibold">Devices &amp; ecosystem</h1>
        <div className="flex gap-3 text-sm">
          <Link to="/tile" className="text-cyan-400 hover:underline">
            Tile simulator
          </Link>
          <Link to="/settings" className="text-cyan-400 hover:underline">
            Settings
          </Link>
        </div>
      </div>
      <p className="text-sm text-zinc-500">
        Phase 7 — one continuity core (this API), multiple thin shells. Watch and accessories get minimal
        payloads; cloud is never required.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(st?.deviceSyncOptIn)}
          onChange={(e) => patchSettings.mutate({ deviceSyncOptIn: e.target.checked })}
        />
        Intent to sync across my devices (transport stays on your LAN/VPN; no mandatory cloud)
      </label>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        <h2 className="text-sm font-medium text-cyan-400">Shell boundaries</h2>
        {shells ? (
          <ul className="text-sm text-zinc-400 space-y-2">
            {Object.entries(shells).map(([k, v]) => (
              <li key={k}>
                <span className="text-zinc-200 font-medium">{k}</span>
                {v.ui ? <span className="text-zinc-500"> — UI: {v.ui}</span> : null}
                {v.boundaries ? (
                  <p className="text-xs text-zinc-500 mt-0.5 pl-2 border-l border-zinc-700">{v.boundaries}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">No manifest.</p>
        )}
      </section>

      <section className="rounded-lg border border-zinc-800 p-4 space-y-2">
        <h2 className="text-sm font-medium text-zinc-400">Register this shell</h2>
        <p className="text-xs text-zinc-500">
          Client id is generated in the browser for demo; native apps should persist a stable id.
        </p>
        <input
          className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs font-mono"
          readOnly
          value={clientDeviceId}
        />
        <input
          className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
          placeholder="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <select
          className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
        >
          <option value="phone">phone</option>
          <option value="watch">watch</option>
          <option value="accessory">accessory</option>
          <option value="private_node">private_node</option>
        </select>
        <button
          type="button"
          className="rounded bg-cyan-950/40 px-3 py-1 text-sm"
          onClick={() => register.mutate()}
        >
          Register device
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-400">Registered devices</h2>
        <ul className="space-y-2">
          {((devices.data?.data ?? []) as { id: string; label: string; role: string; lastSeenAt: string }[]).map(
            (d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded border border-zinc-800 px-3 py-2 text-sm"
              >
                <span>
                  {d.label} <span className="text-zinc-500">({d.role})</span>
                </span>
                <button
                  type="button"
                  className="text-xs text-red-400 hover:underline"
                  onClick={() => remove.mutate(d.id)}
                >
                  Revoke
                </button>
              </li>
            ),
          )}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-800 p-4 space-y-2">
        <h2 className="text-sm font-medium text-zinc-400">Watch surface preview</h2>
        <p className="text-xs text-zinc-500">
          Same payload a watch client would call — minimal context, suggestion id for dismiss/confirm flows.
        </p>
        {watchPreview.isLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <pre className="text-xs text-zinc-400 overflow-x-auto bg-zinc-950 p-3 rounded">
            {JSON.stringify(watchPreview.data, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
