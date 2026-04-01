import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { lifeOsApi } from '../lib/api';

export default function TileSimulator() {
  const qc = useQueryClient();
  const tile = useQuery({ queryKey: ['tile-current'], queryFn: () => lifeOsApi.getTileCurrent() });
  const modes = useQuery({ queryKey: ['tile-modes'], queryFn: () => lifeOsApi.getTileModes() });

  const cycle = useMutation({
    mutationFn: () => lifeOsApi.postTileAction({ action: 'cycle_mode' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tile-current'] });
      void qc.invalidateQueries({ queryKey: ['tile-modes'] });
    },
  });

  const clearManual = useMutation({
    mutationFn: () => lifeOsApi.postTileAction({ action: 'clear_manual_mode' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tile-current'] });
      void qc.invalidateQueries({ queryKey: ['tile-modes'] });
    },
  });

  const t = tile.data;

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-zinc-200">Ambient tile (simulator)</h1>
        <Link to="/ecosystem" className="text-sm text-cyan-400 hover:underline">
          Ecosystem
        </Link>
      </div>
      <p className="text-sm text-zinc-500">
        Hardware-agnostic preview of <code className="text-zinc-400">GET /surfaces/tile/current</code> — calm,
        low-density, redacted by default.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-zinc-600 px-3 py-1 text-sm text-zinc-300 hover:bg-zinc-800"
          onClick={() => cycle.mutate()}
          disabled={cycle.isPending}
        >
          Cycle mode
        </button>
        <button
          type="button"
          className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-500 hover:bg-zinc-800"
          onClick={() => clearManual.mutate()}
          disabled={clearManual.isPending}
        >
          Use auto mode
        </button>
      </div>

      {modes.data ? (
        <p className="text-xs text-zinc-600">
          Manual override: {modes.data.manualOverride ?? 'none'} · effective: {modes.data.effectiveMode}
        </p>
      ) : null}

      <div
        className="rounded-xl border border-zinc-700 bg-[#1a1a1c] p-6 min-h-[220px] font-mono text-zinc-200 shadow-inner"
        style={{ fontFamily: 'ui-monospace, monospace' }}
      >
        {tile.isLoading ? (
          <p className="text-zinc-500">Loading…</p>
        ) : t ? (
          <div className="space-y-4">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">
              {t.mode.replace(/_/g, ' ')} · {t.privacyClass} · {t.urgencyLevel}
            </div>
            <div>
              <div className="text-lg leading-snug">{t.primaryHeadline}</div>
              {t.primarySubline ? (
                <div className="text-sm text-zinc-500 mt-1">{t.primarySubline}</div>
              ) : null}
            </div>
            {t.secondaryHeadline ? (
              <div className="pt-2 border-t border-zinc-800">
                <div className="text-sm">{t.secondaryHeadline}</div>
                {t.secondarySubline ? (
                  <div className="text-xs text-zinc-500 mt-0.5">{t.secondarySubline}</div>
                ) : null}
              </div>
            ) : null}
            <div className="text-[10px] text-zinc-600 pt-2">
              {t.actionHint !== 'none' ? `${t.actionHint} · ` : null}
              {t.lastUpdatedAt.slice(11, 19)} local preview
            </div>
          </div>
        ) : (
          <p className="text-zinc-500">No data</p>
        )}
      </div>

      <p className="text-xs text-zinc-600">
        Enable “ambient tile show detail” in Settings to see less redacted labels (still no raw financial amounts on
        this surface).
      </p>
    </div>
  );
}
