import type { TileDisplayModel, TileMode, TilePrivacyClass, TileActionHint, TileUrgencyLevel } from '@life-os/types';
import { TILE_MODES_ORDER } from '@life-os/types';
import { prisma } from '@life-os/database';
import {
  adminRenewalHeadline,
  adminReturnHeadline,
  eventHeadline,
  eventSubline,
  obligationHeadline,
  obligationSubline,
  type RedactionContext,
} from '../lib/privacy-redaction.js';

function isTileMode(s: string | null | undefined): s is TileMode {
  return Boolean(s && TILE_MODES_ORDER.includes(s as TileMode));
}

function pickAutoMode(args: {
  meetingSoon: boolean;
  adminSoon: boolean;
}): TileMode {
  if (args.meetingSoon) return 'meeting';
  if (args.adminSoon) return 'admin';
  return 'calm_brief';
}

/**
 * Build redacted, calm tile state from obligations, calendar, admin signals — not raw connector data.
 *
 * **Mediation:** `AssistantMediation` applies to ranked suggestions in the daily brief and companion APIs.
 * This tile model does not embed `AssistantMediationLog` rows; obligations/events here are not passed through
 * `decideMediation`. Privacy is enforced via redaction (`privacy-redaction`) and user settings — see
 * `docs/ASSISTANT_MEDIATION_ENGINE_BLUEPRINT.md` §11.
 */
export async function buildTileDisplayModel(userId: string): Promise<TileDisplayModel> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const now = new Date();
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const in72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const ctx: RedactionContext = {
    redactLabels: !settings?.ambientTileShowDetail,
    privacyStrict: settings?.privacyStrictMode ?? true,
  };

  const [topObligation, nextEvent, renewalSoon, returnSoon] = await Promise.all([
    prisma.obligation.findFirst({
      where: { userId, status: 'open' },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.event.findFirst({
      where: { userId, startsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
    }),
    prisma.subscription.findFirst({
      where: { userId, active: true, renewalAt: { gte: now, lte: horizon } },
      orderBy: { renewalAt: 'asc' },
    }),
    prisma.purchase.findFirst({
      where: { userId, returnWindowEndsAt: { gte: now, lte: horizon } },
      orderBy: { returnWindowEndsAt: 'asc' },
    }),
  ]);

  const meetingSoon = Boolean(
    nextEvent?.startsAt && nextEvent.startsAt <= in2h && nextEvent.startsAt >= now,
  );
  const renewal72 =
    renewalSoon?.renewalAt && renewalSoon.renewalAt <= in72h && renewalSoon.renewalAt >= now;
  const return72 =
    returnSoon?.returnWindowEndsAt &&
    returnSoon.returnWindowEndsAt <= in72h &&
    returnSoon.returnWindowEndsAt >= now;
  const adminSoon = Boolean(renewal72 || return72);

  let mode: TileMode = pickAutoMode({ meetingSoon, adminSoon });
  if (isTileMode(settings?.ambientTileManualMode)) {
    mode = settings!.ambientTileManualMode as TileMode;
  }

  if (mode === 'private_minimal') {
    ctx.redactLabels = true;
  }

  let primaryHeadline = 'All clear';
  let primarySubline: string | undefined;
  let secondaryHeadline: string | undefined;
  let secondarySubline: string | undefined;
  let urgencyLevel: TileUrgencyLevel = 'low';
  let privacyClass: TilePrivacyClass = ctx.redactLabels || ctx.privacyStrict ? 'redacted' : 'standard';
  if (mode === 'private_minimal') privacyClass = 'minimal';

  const ref: TileDisplayModel['ref'] = {};

  if (topObligation) ref.obligationId = topObligation.id;
  if (nextEvent?.id) ref.eventId = nextEvent.id;

  switch (mode) {
    case 'meeting':
      primaryHeadline = nextEvent
        ? eventHeadline(nextEvent.title, ctx)
        : 'Next meeting';
      primarySubline = nextEvent ? eventSubline(nextEvent.startsAt, ctx) : undefined;
      if (topObligation) {
        secondaryHeadline = obligationHeadline(topObligation.title, ctx);
        secondarySubline = obligationSubline(topObligation.dueAt, ctx);
      }
      urgencyLevel = meetingSoon ? 'elevated' : 'normal';
      break;
    case 'admin':
      if (renewalSoon && renewal72) {
        primaryHeadline = adminRenewalHeadline(renewalSoon.name, ctx);
        primarySubline = ctx.redactLabels ? 'Soon' : `By ${renewalSoon.renewalAt.toISOString().slice(0, 10)}`;
        ref.subscriptionId = renewalSoon.id;
      } else if (returnSoon && return72) {
        primaryHeadline = adminReturnHeadline(returnSoon.title, ctx);
        primarySubline = ctx.redactLabels ? 'Soon' : `By ${returnSoon.returnWindowEndsAt!.toISOString().slice(0, 10)}`;
      } else {
        primaryHeadline = 'No urgent admin signals';
        primarySubline = 'Open phone for renewals and returns';
      }
      if (topObligation) {
        secondaryHeadline = obligationHeadline(topObligation.title, ctx);
        secondarySubline = obligationSubline(topObligation.dueAt, ctx);
      }
      urgencyLevel = 'elevated';
      break;
    case 'focus':
      primaryHeadline = 'Focus block';
      primarySubline = 'Open phone for session detail';
      secondaryHeadline = topObligation ? obligationHeadline(topObligation.title, ctx) : 'No urgent carryover';
      urgencyLevel = 'low';
      break;
    case 'evening_carryover':
      primaryHeadline = topObligation ? obligationHeadline(topObligation.title, ctx) : 'Nothing pending';
      primarySubline = topObligation ? obligationSubline(topObligation.dueAt, ctx) : 'Wind down';
      secondaryHeadline = nextEvent ? eventHeadline(nextEvent.title, ctx) : undefined;
      secondarySubline = nextEvent ? eventSubline(nextEvent.startsAt, ctx) : undefined;
      urgencyLevel = 'low';
      break;
    case 'private_minimal':
      primaryHeadline = '•';
      primarySubline = 'Status';
      secondaryHeadline = topObligation ? '•' : undefined;
      secondarySubline = topObligation ? 'Task' : undefined;
      urgencyLevel = 'low';
      break;
    case 'calm_brief':
    default:
      primaryHeadline = topObligation ? obligationHeadline(topObligation.title, ctx) : 'No open follow-ups';
      primarySubline = topObligation ? obligationSubline(topObligation.dueAt, ctx) : 'Good moment to plan';
      if (nextEvent) {
        secondaryHeadline = eventHeadline(nextEvent.title, ctx);
        secondarySubline = eventSubline(nextEvent.startsAt, ctx);
      } else if (renewalSoon && renewalSoon.renewalAt <= in72h) {
        secondaryHeadline = adminRenewalHeadline(renewalSoon.name, ctx);
      }
      urgencyLevel = topObligation?.dueAt && topObligation.dueAt < in72h ? 'normal' : 'low';
      break;
  }

  const actionHint: TileActionHint =
    mode === 'meeting' || mode === 'admin' || mode === 'calm_brief'
      ? 'open_phone_for_details'
      : 'none';

  const out: TileDisplayModel = {
    mode,
    primaryHeadline,
    primarySubline,
    secondaryHeadline,
    secondarySubline,
    urgencyLevel,
    privacyClass,
    actionHint,
    lastUpdatedAt: new Date().toISOString(),
  };
  if (ref && Object.keys(ref).length > 0) out.ref = ref;
  return out;
}

/** Next mode in rotation for POST /surfaces/tile/action cycle_mode. */
export function cycleTileMode(current: TileMode | null | undefined): TileMode {
  const idx = current ? TILE_MODES_ORDER.indexOf(current) : -1;
  const next = (idx + 1) % TILE_MODES_ORDER.length;
  return TILE_MODES_ORDER[next]!;
}
