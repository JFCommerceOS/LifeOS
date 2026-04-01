import type { PolicyDecisionArea, PolicyEngineResult, Prisma } from '@prisma/client';
import { prisma } from '@life-os/database';
import {
  evaluateExportPolicy,
  evaluateStoragePolicy,
  evaluateSurfacePolicy,
} from '@life-os/policy';

function toEngineResult(s: string): PolicyEngineResult {
  return s as PolicyEngineResult;
}

export async function evaluatePolicyAndLog(args: {
  userId: string;
  sourceEntityType: string;
  sourceEntityId: string;
  decisionArea: PolicyDecisionArea;
  input: Record<string, unknown>;
}): Promise<{ decisionResult: PolicyEngineResult; reasonCode: string }> {
  let decisionResult: PolicyEngineResult = 'ALLOW';
  let reasonCode = 'default';

  const deviceTrust = (args.input.deviceTrust as string) ?? 'TRUSTED';
  const domainClass = (args.input.domainClass as string) ?? 'GENERAL';

  if (args.decisionArea === 'STORAGE') {
    const r = evaluateStoragePolicy({
      domainClass,
      userMarkedLocalOnly: Boolean(args.input.userMarkedLocalOnly),
      userMarkedArchiveOnly: Boolean(args.input.userMarkedArchiveOnly),
    });
    decisionResult = toEngineResult(r.result);
    reasonCode = r.reasonCode;
  } else if (args.decisionArea === 'SURFACING') {
    const r = evaluateSurfacePolicy({
      domainClass,
      surface: (args.input.surface as 'phone' | 'watch' | 'desktop' | 'lock_screen' | 'daily_brief') ?? 'phone',
      deviceTrust: deviceTrust as 'PENDING' | 'TRUSTED' | 'LIMITED' | 'REVOKED',
      watchSensitiveDetailOptIn: Boolean(args.input.watchSensitiveDetailOptIn),
    });
    decisionResult = toEngineResult(r.result);
    reasonCode = r.reasonCode;
  } else if (args.decisionArea === 'EXPORT') {
    const r = evaluateExportPolicy({
      domainClass,
      includeSensitive: Boolean(args.input.includeSensitive),
      deviceTrust: deviceTrust as 'PENDING' | 'TRUSTED' | 'LIMITED' | 'REVOKED',
    });
    decisionResult = toEngineResult(r.result);
    reasonCode = r.reasonCode;
  } else {
    reasonCode = 'area_not_implemented';
    decisionResult = 'ALLOW';
  }

  await prisma.policyDecisionLog.create({
    data: {
      userId: args.userId,
      sourceEntityType: args.sourceEntityType,
      sourceEntityId: args.sourceEntityId,
      decisionArea: args.decisionArea,
      decisionResult,
      reasonCode,
      contextJson: args.input as unknown as Prisma.InputJsonValue,
    },
  });

  return { decisionResult, reasonCode };
}
