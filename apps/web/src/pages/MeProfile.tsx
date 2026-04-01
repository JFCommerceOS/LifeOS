import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { lifeOsApi } from '../lib/api';

type Profile = {
  profileType: string;
  reminderTiming: string;
  notificationDensity: string;
  nudgeStyle: string;
  emphasisWork: number;
  emphasisFamily: number;
  emphasisHealth: number;
  inferredJson: string;
};

export default function MeProfile() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['me-profile'], queryFn: () => lifeOsApi.getProfile() });

  const [profileType, setProfileType] = useState('mixed');
  const [reminderTiming, setReminderTiming] = useState('balanced');
  const [notificationDensity, setNotificationDensity] = useState('normal');
  const [nudgeStyle, setNudgeStyle] = useState('gentle');

  const profile = q.data?.profile as Profile | undefined;
  useEffect(() => {
    if (profile) {
      setProfileType(profile.profileType);
      setReminderTiming(profile.reminderTiming);
      setNotificationDensity(profile.notificationDensity);
      setNudgeStyle(profile.nudgeStyle);
    }
  }, [profile?.profileType, profile?.reminderTiming, profile?.notificationDensity, profile?.nudgeStyle]);

  const save = useMutation({
    mutationFn: () =>
      lifeOsApi.patchProfile({
        profileType,
        reminderTiming,
        notificationDensity,
        nudgeStyle,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['me-profile'] }),
  });

  const recompute = useMutation({
    mutationFn: () => lifeOsApi.postProfileRecompute(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['me-profile'] }),
  });

  if (q.isLoading) return <p className="text-zinc-500">Loading…</p>;
  if (q.isError) return <p className="text-red-400">{(q.error as Error).message}</p>;

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-xl font-semibold">Profile & style</h1>
      <p className="text-sm text-zinc-500">
        Phase 3 — tuning only; suggestion ranking uses this lightly (see suggestion rank factor{' '}
        <code className="text-cyan-400">profile_tune</code>).
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Profile type</span>
          <select
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5"
            value={profileType}
            onChange={(e) => setProfileType(e.target.value)}
          >
            {['professional', 'student', 'parent', 'freelancer', 'caregiver', 'mixed'].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Reminder timing</span>
          <select
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5"
            value={reminderTiming}
            onChange={(e) => setReminderTiming(e.target.value)}
          >
            {['morning', 'afternoon', 'evening', 'balanced'].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Notification density</span>
          <select
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5"
            value={notificationDensity}
            onChange={(e) => setNotificationDensity(e.target.value)}
          >
            {['low', 'normal', 'high'].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Nudges</span>
          <select
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5"
            value={nudgeStyle}
            onChange={(e) => setNudgeStyle(e.target.value)}
          >
            {['gentle', 'strict'].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="rounded bg-cyan-600 px-3 py-1.5 text-sm text-white"
        >
          Save
        </button>
        <button
          type="button"
          disabled={recompute.isPending}
          onClick={() => recompute.mutate()}
          className="rounded border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300"
        >
          Recompute inference (stub)
        </button>
      </div>

      {profile?.inferredJson ? (
        <pre className="text-xs text-zinc-500 overflow-auto rounded border border-zinc-800 p-2 bg-zinc-950/80">
          {profile.inferredJson}
        </pre>
      ) : null}
    </div>
  );
}
