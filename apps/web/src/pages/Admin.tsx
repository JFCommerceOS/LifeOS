import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { lifeOsApi } from '../lib/api';

function isoFromDatetimeLocal(s: string): string {
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export default function Admin() {
  const qc = useQueryClient();
  const summary = useQuery({ queryKey: ['admin-summary'], queryFn: () => lifeOsApi.getAdminSummary() });
  const overview = useQuery({ queryKey: ['admin-overview'], queryFn: () => lifeOsApi.getAdminOverview() });
  const adminRecords = useQuery({ queryKey: ['admin-records'], queryFn: () => lifeOsApi.getAdminRecords(1) });
  const purchases = useQuery({ queryKey: ['purchases'], queryFn: () => lifeOsApi.getPurchases(1) });
  const subs = useQuery({ queryKey: ['subscriptions'], queryFn: () => lifeOsApi.getSubscriptions(1) });
  const appts = useQuery({ queryKey: ['life-appointments'], queryFn: () => lifeOsApi.getLifeAppointments(1) });
  const reminders = useQuery({ queryKey: ['reminders'], queryFn: () => lifeOsApi.getReminders(1) });

  const [pTitle, setPTitle] = useState('Headphones');
  const [pReturn, setPReturn] = useState('');
  const [sName, setSName] = useState('Cloud storage');
  const [sRenew, setSRenew] = useState('');
  const [aTitle, setATitle] = useState('Dentist');
  const [aStart, setAStart] = useState('');

  const createPurchase = useMutation({
    mutationFn: () =>
      lifeOsApi.postPurchase({
        title: pTitle,
        purchasedAt: new Date().toISOString(),
        returnWindowEndsAt: pReturn ? isoFromDatetimeLocal(pReturn) : null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['purchases'] });
      void qc.invalidateQueries({ queryKey: ['admin-summary'] });
      void qc.invalidateQueries({ queryKey: ['admin-overview'] });
      void qc.invalidateQueries({ queryKey: ['admin-records'] });
      void qc.invalidateQueries({ queryKey: ['reminders'] });
    },
  });

  const createSub = useMutation({
    mutationFn: () =>
      lifeOsApi.postSubscription({
        name: sName,
        renewalAt: sRenew ? isoFromDatetimeLocal(sRenew) : new Date(Date.now() + 86400000).toISOString(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subscriptions'] });
      void qc.invalidateQueries({ queryKey: ['admin-summary'] });
      void qc.invalidateQueries({ queryKey: ['admin-overview'] });
      void qc.invalidateQueries({ queryKey: ['admin-records'] });
      void qc.invalidateQueries({ queryKey: ['reminders'] });
    },
  });

  const createAppt = useMutation({
    mutationFn: () =>
      lifeOsApi.postLifeAppointment({
        title: aTitle,
        startsAt: aStart ? isoFromDatetimeLocal(aStart) : new Date(Date.now() + 86400000).toISOString(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['life-appointments'] });
      void qc.invalidateQueries({ queryKey: ['reminders'] });
    },
  });

  const renewals = (summary.data?.upcomingRenewals ?? []) as { id: string; name: string; renewalAt: string }[];
  const returns = (summary.data?.returnWindowsClosing ?? []) as {
    id: string;
    title: string;
    returnWindowEndsAt: string | null;
  }[];
  const adminActive = summary.data?.adminActiveCount;
  const activeAdminRows = (overview.data?.active ?? []) as {
    id: string;
    title: string;
    adminType: string;
    status: string;
    dueAt?: string | null;
  }[];
  const adminListRows = (adminRecords.data?.data ?? []) as {
    id: string;
    title: string;
    adminType: string;
    status: string;
  }[];

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Admin Guard</h1>
      <p className="text-sm text-zinc-500">
        Structured admin records (bills, receipts, renewals) from documents and notes; purchases, subscriptions,
        appointments, and reminders.
      </p>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
        <h2 className="text-sm font-medium text-cyan-400">Admin records (Sprint 07)</h2>
        {adminActive != null ? (
          <p className="text-sm text-zinc-400">
            Active admin records: <span className="text-zinc-200">{adminActive}</span>
          </p>
        ) : null}
        {overview.isLoading || adminRecords.isLoading ? (
          <p className="text-sm text-zinc-500">Loading records…</p>
        ) : (
          <>
            <div>
              <h3 className="text-xs uppercase text-zinc-500">Active (overview)</h3>
              {activeAdminRows.length === 0 ? (
                <p className="text-sm text-zinc-500">None yet — upload a bill or receipt, or add a note with admin cues.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {activeAdminRows.slice(0, 12).map((r) => (
                    <li key={r.id}>
                      <Link to={`/admin/${r.id}`} className="text-cyan-400 hover:underline">
                        {r.title}
                      </Link>
                      <span className="text-zinc-500">
                        {' '}
                        — {r.adminType.replace(/_/g, ' ')}
                        {r.dueAt ? ` · ${new Date(r.dueAt).toLocaleDateString()}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-xs uppercase text-zinc-500">All (paginated)</h3>
              <ul className="text-sm space-y-1">
                {adminListRows.map((r) => (
                  <li key={r.id}>
                    <Link to={`/admin/${r.id}`} className="text-cyan-400 hover:underline">
                      {r.title}
                    </Link>
                    <span className="text-zinc-500"> — {r.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
        <h2 className="text-sm font-medium text-cyan-400">Next 14 days</h2>
        {summary.isLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <>
            <div>
              <h3 className="text-xs uppercase text-zinc-500">Upcoming renewals</h3>
              {renewals.length === 0 ? (
                <p className="text-sm text-zinc-500">None in window.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {renewals.map((r) => (
                    <li key={r.id}>
                      {r.name} — {new Date(r.renewalAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-xs uppercase text-zinc-500">Return windows closing</h3>
              {returns.length === 0 ? (
                <p className="text-sm text-zinc-500">None in window.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {returns.map((r) => (
                    <li key={r.id}>
                      {r.title} —{' '}
                      {r.returnWindowEndsAt
                        ? new Date(r.returnWindowEndsAt).toLocaleString()
                        : '—'}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
        <h2 className="text-sm font-medium text-zinc-300">Add purchase + return window</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            value={pTitle}
            onChange={(e) => setPTitle(e.target.value)}
            placeholder="Title"
          />
          <input
            type="datetime-local"
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            value={pReturn}
            onChange={(e) => setPReturn(e.target.value)}
          />
          <button
            type="button"
            disabled={createPurchase.isPending}
            onClick={() => createPurchase.mutate()}
            className="rounded bg-cyan-600 px-3 py-1 text-sm text-white"
          >
            Save
          </button>
        </div>
        {createPurchase.isError ? (
          <p className="text-xs text-red-400">{(createPurchase.error as Error).message}</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
        <h2 className="text-sm font-medium text-zinc-300">Add subscription</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            value={sName}
            onChange={(e) => setSName(e.target.value)}
          />
          <input
            type="datetime-local"
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            value={sRenew}
            onChange={(e) => setSRenew(e.target.value)}
          />
          <button
            type="button"
            disabled={createSub.isPending}
            onClick={() => createSub.mutate()}
            className="rounded bg-cyan-600 px-3 py-1 text-sm text-white"
          >
            Save
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
        <h2 className="text-sm font-medium text-zinc-300">Add life appointment</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            value={aTitle}
            onChange={(e) => setATitle(e.target.value)}
          />
          <input
            type="datetime-local"
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            value={aStart}
            onChange={(e) => setAStart(e.target.value)}
          />
          <button
            type="button"
            disabled={createAppt.isPending}
            onClick={() => createAppt.mutate()}
            className="rounded bg-cyan-600 px-3 py-1 text-sm text-white"
          >
            Save
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 p-4 space-y-2">
        <h2 className="text-sm font-medium text-zinc-400">Lists</h2>
        <div className="grid gap-4 md:grid-cols-2 text-sm">
          <div>
            <h3 className="text-xs uppercase text-zinc-500 mb-1">Purchases</h3>
            <ul className="space-y-1 text-zinc-300">
              {((purchases.data?.data ?? []) as { id: string; title: string }[]).map((p) => (
                <li key={p.id}>{p.title}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs uppercase text-zinc-500 mb-1">Subscriptions</h3>
            <ul className="space-y-1 text-zinc-300">
              {((subs.data?.data ?? []) as { id: string; name: string }[]).map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs uppercase text-zinc-500 mb-1">Life appointments</h3>
            <ul className="space-y-1 text-zinc-300">
              {((appts.data?.data ?? []) as { id: string; title: string }[]).map((p) => (
                <li key={p.id}>{p.title}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs uppercase text-zinc-500 mb-1">Reminders</h3>
            <ul className="space-y-1 text-zinc-300">
              {((reminders.data?.data ?? []) as { id: string; title: string; fireAt: string }[]).map((p) => (
                <li key={p.id}>
                  {p.title} — {new Date(p.fireAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
