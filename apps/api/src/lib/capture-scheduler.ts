import { writeAudit } from './audit.js';

export type CaptureSource = 'note' | 'task' | 'event' | 'voice';

/**
 * Run signal intake + brief refresh **without blocking** the HTTP response (MVP latency).
 * Failures are recorded in `audit_logs` as `capture.signal_failed` for observability.
 */
export function scheduleCapturePipeline(
  userId: string,
  source: CaptureSource,
  meta: { entityType?: string; entityId?: string },
  run: () => Promise<unknown>,
): void {
  void run().catch(async (err) => {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await writeAudit(userId, 'capture.signal_failed', {
        entityType: meta.entityType,
        entityId: meta.entityId,
        meta: { source, error: message.slice(0, 500) },
      });
    } catch {
      /* Avoid unhandled rejection if Prisma is already disconnected (e.g. test teardown). */
    }
  });
}
