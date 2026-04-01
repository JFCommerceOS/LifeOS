import type { DocumentFamily } from '@prisma/client';
import {
  ClassificationSensitivityLevel,
  DomainClass,
  StorageRestriction,
  SurfaceRestriction,
} from '@prisma/client';
import { prisma } from '@life-os/database';

function familyToDomain(family: DocumentFamily): DomainClass {
  if (family === 'HEALTH') return DomainClass.HEALTH;
  if (family === 'FINANCE_ADMIN') return DomainClass.FINANCE;
  if (family === 'EDUCATION') return DomainClass.EDUCATION;
  return DomainClass.GENERAL;
}

function sensitivityFor(family: DocumentFamily): ClassificationSensitivityLevel {
  if (family === 'HEALTH' || family === 'FINANCE_ADMIN') return ClassificationSensitivityLevel.HIGH;
  if (family === 'EDUCATION') return ClassificationSensitivityLevel.MODERATE;
  return ClassificationSensitivityLevel.LOW;
}

function surfaceFor(family: DocumentFamily): SurfaceRestriction {
  if (family === 'HEALTH' || family === 'FINANCE_ADMIN') return SurfaceRestriction.REDACT_SMALL_SCREEN;
  return SurfaceRestriction.FULL;
}

function storageFor(family: DocumentFamily): StorageRestriction {
  if (family === 'HEALTH' || family === 'FINANCE_ADMIN') return StorageRestriction.ENCRYPTED_AT_REST;
  return StorageRestriction.STANDARD;
}

export async function upsertDataClassificationForDocument(args: {
  userId: string;
  documentId: string;
  documentFamily: DocumentFamily;
}): Promise<void> {
  const domainClass = familyToDomain(args.documentFamily);

  await prisma.dataClassification.upsert({
    where: {
      userId_linkedEntityType_linkedEntityId: {
        userId: args.userId,
        linkedEntityType: 'Document',
        linkedEntityId: args.documentId,
      },
    },
    create: {
      userId: args.userId,
      linkedEntityType: 'Document',
      linkedEntityId: args.documentId,
      domainClass,
      sensitivityLevel: sensitivityFor(args.documentFamily),
      requiresConfirmation: domainClass === DomainClass.HEALTH || domainClass === DomainClass.FINANCE,
      surfaceRestriction: surfaceFor(args.documentFamily),
      storageRestriction: storageFor(args.documentFamily),
    },
    update: {
      domainClass,
      sensitivityLevel: sensitivityFor(args.documentFamily),
      requiresConfirmation: domainClass === DomainClass.HEALTH || domainClass === DomainClass.FINANCE,
      surfaceRestriction: surfaceFor(args.documentFamily),
      storageRestriction: storageFor(args.documentFamily),
      updatedAt: new Date(),
    },
  });
}
