import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { lifeOsApi } from '../lib/api';
import { los } from '../design/tokens';

type AdminRecordRow = {
  id: string;
  title: string;
  adminType: string;
  status: string;
  issuerName?: string | null;
  amountValue?: number | null;
  currencyCode?: string | null;
  dueAt?: string | null;
  renewsAt?: string | null;
  returnWindowEndsAt?: string | null;
  reasonSummary?: string | null;
  extractionConfidence?: number | null;
  document?: { id: string; title: string; processingStatus?: string } | null;
};

export default function AdminRecordDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin-record', id],
    queryFn: () => lifeOsApi.getAdminRecord(id!),
    enabled: Boolean(id),
  });

  const record = q.data?.record as AdminRecordRow | undefined;
  const ob = q.data?.obligation as { id: string; title: string; status: string } | null | undefined;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin-record', id] });
    void qc.invalidateQueries({ queryKey: ['admin-overview'] });
    void qc.invalidateQueries({ queryKey: ['admin-records'] });
    void qc.invalidateQueries({ queryKey: ['admin-summary'] });
  };

  const markPaid = useMutation({
    mutationFn: () => lifeOsApi.postAdminMarkPaid(id!, {}),
    onSuccess: invalidate,
  });
  const complete = useMutation({
    mutationFn: () => lifeOsApi.postAdminComplete(id!, {}),
    onSuccess: invalidate,
  });
  const snooze = useMutation({
    mutationFn: () =>
      lifeOsApi.postAdminSnooze(id!, {
        snoozeUntil: new Date(Date.now() + 3 * 86400000).toISOString(),
      }),
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: () => lifeOsApi.postAdminArchive(id!, {}),
    onSuccess: invalidate,
  });
  const dismiss = useMutation({
    mutationFn: () => lifeOsApi.postAdminDismiss(id!, {}),
    onSuccess: invalidate,
  });

  if (!id) {
    return (
      <p className={los.textMuted}>
        Missing id. <Link to="/admin">Back to Admin</Link>
      </p>
    );
  }

  if (q.isLoading) {
    return <p className={los.textMuted}>Loading…</p>;
  }

  if (q.isError || !record) {
    return (
      <p className="text-red-400">
        {(q.error as Error)?.message ?? 'Not found.'}{' '}
        <Link to="/admin" className="text-cyan-400 underline">
          Back
        </Link>
      </p>
    );
  }

  const anchor = record.dueAt ?? record.renewsAt ?? record.returnWindowEndsAt;

  return (
    <div className="space-y-6">
      <p>
        <Link to="/admin" className="text-sm text-cyan-400 hover:underline">
          ← Admin Guard
        </Link>
      </p>
      <div>
        <h1 className="text-xl font-semibold">{record.title}</h1>
        <p className="text-sm text-zinc-500">
          {record.adminType.replace(/_/g, ' ')} · {record.status}
          {record.extractionConfidence != null
            ? ` · confidence ${(record.extractionConfidence * 100).toFixed(0)}%`
            : ''}
        </p>
      </div>

      {record.reasonSummary ? <p className="text-sm text-zinc-300">{record.reasonSummary}</p> : null}

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {record.issuerName ? (
          <>
            <dt className="text-zinc-500">Issuer</dt>
            <dd>{record.issuerName}</dd>
          </>
        ) : null}
        {record.amountValue != null ? (
          <>
            <dt className="text-zinc-500">Amount</dt>
            <dd>
              {record.currencyCode ?? 'USD'} {record.amountValue.toFixed(2)}
            </dd>
          </>
        ) : null}
        {anchor ? (
          <>
            <dt className="text-zinc-500">Next date</dt>
            <dd>{new Date(anchor).toLocaleString()}</dd>
          </>
        ) : null}
        {record.document ? (
          <>
            <dt className="text-zinc-500">Source document</dt>
            <dd>
              <Link to={`/documents/${record.document.id}`} className="text-cyan-400 hover:underline">
                {record.document.title}
              </Link>
            </dd>
          </>
        ) : null}
        {ob ? (
          <>
            <dt className="text-zinc-500">Linked obligation</dt>
            <dd>
              <Link to="/obligations" className="text-cyan-400 hover:underline">
                {ob.title} ({ob.status})
              </Link>
            </dd>
          </>
        ) : null}
      </dl>

      {record.status === 'ACTIVE' ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={markPaid.isPending}
            onClick={() => markPaid.mutate()}
            className="rounded bg-cyan-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Mark paid
          </button>
          <button
            type="button"
            disabled={complete.isPending}
            onClick={() => complete.mutate()}
            className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Complete
          </button>
          <button
            type="button"
            disabled={snooze.isPending}
            onClick={() => snooze.mutate()}
            className="rounded border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 disabled:opacity-50"
          >
            Snooze 3d
          </button>
          <button
            type="button"
            disabled={archive.isPending}
            onClick={() => archive.mutate()}
            className="rounded border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 disabled:opacity-50"
          >
            Archive
          </button>
          <button
            type="button"
            disabled={dismiss.isPending}
            onClick={() => dismiss.mutate()}
            className="rounded border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 disabled:opacity-50"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}
