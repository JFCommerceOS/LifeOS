import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { SectionHeader } from '../components/ui/SectionHeader';
import { los } from '../design/tokens';
import { formatApiError } from '../lib/format-api-error';
import { lifeOsApi } from '../lib/api';

type MemoryRow = {
  id: string;
  nodeType: string;
  summary: string;
  confidence: number;
  strengthScore: number;
  layerType: string;
  refEntityType: string | null;
  refEntityId: string | null;
  updatedAt: string;
};

export default function Memory() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [page] = useState(1);
  const list = useQuery({
    queryKey: ['memory', page],
    queryFn: () => lifeOsApi.getMemory(page),
    staleTime: 15_000,
  });

  const confirm = useMutation({
    mutationFn: (memoryNodeId: string) =>
      lifeOsApi.postMemoryConfirm({ memoryNodeId, confirmed: true }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['memory'] });
    },
  });

  const rows = (list.data?.data ?? []) as MemoryRow[];

  return (
    <div className="space-y-8">
      <SectionHeader title={t('memory.title')} subtitle={t('memory.subtitle')} />

      {list.isError && (
        <p className="text-sm text-rose-300" role="alert">
          {formatApiError(list.error, t)}
        </p>
      )}

      {list.isLoading ? (
        <p className={los.textMuted}>{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p className={los.textMuted}>{t('memory.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0F1624]/80">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-white/10 text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">{t('memory.colSummary')}</th>
                <th className="px-3 py-2 font-medium">{t('memory.colLayer')}</th>
                <th className="px-3 py-2 font-medium">{t('memory.colStrength')}</th>
                <th className="px-3 py-2 font-medium">{t('memory.colConfidence')}</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="max-w-md px-3 py-2.5 text-slate-200">
                    <Link
                      to={`/memory/${r.id}`}
                      className={`text-left ${los.accentLink} ${los.focusRing} rounded`}
                    >
                      {r.summary.length > 160 ? `${r.summary.slice(0, 157)}…` : r.summary}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">{r.layerType}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">
                    {(r.strengthScore * 100).toFixed(0)}%
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">
                    {(r.confidence * 100).toFixed(0)}%
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <button
                      type="button"
                      className={`text-cyan-300/90 hover:text-cyan-200 ${los.focusRing} rounded px-1`}
                      onClick={() => void confirm.mutateAsync(r.id)}
                      disabled={confirm.isPending}
                    >
                      {t('memory.confirm')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className={`text-sm ${los.textMuted}`}>
        Open a row for lineage, evidence context, and correction.
      </p>
    </div>
  );
}
