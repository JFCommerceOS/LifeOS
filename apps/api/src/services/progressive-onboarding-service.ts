import { CAPABILITY_DEFINITIONS } from './capability-catalog.js';
import { listCapabilitiesForUser } from './capability-registry-service.js';

type CapRow = { capabilityKey: string; runtimeState: string };

/** Next purpose-based prompts to show (capabilities that are not_enabled and have external data sources). */
export async function getOnboardingHints(userId: string) {
  const caps = (await listCapabilitiesForUser(userId)) as CapRow[];
  const byKey = new Map(caps.map((c) => [c.capabilityKey, c]));
  const hints: { capabilityKey: string; purposeLabel: string; purposeCopy: string }[] = [];

  for (const def of CAPABILITY_DEFINITIONS) {
    const row = byKey.get(def.capabilityKey);
    if (!row) continue;
    if (row.runtimeState !== 'not_enabled') continue;
    const needsExternal = def.dataSourcesRequired.some((d) =>
      ['location', 'screen_time_summary', 'screen_time', 'contacts_or_manual_people'].includes(d),
    );
    if (!needsExternal) continue;
    hints.push({
      capabilityKey: def.capabilityKey,
      purposeLabel: def.purposeLabel,
      purposeCopy: def.explanationTemplate,
    });
  }

  return { hints };
}
