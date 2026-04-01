import { prisma } from '@life-os/database';

/** Single-user local dev: ensure one user exists and return id. */
export async function ensureDefaultUser(): Promise<string> {
  const existing = await prisma.user.findFirst();
  if (existing) return existing.id;
  const user = await prisma.user.create({
    data: { email: 'local@lifeos.local' },
  });
  await prisma.userSettings.create({
    data: { userId: user.id },
  });
  return user.id;
}

export async function getUserId(): Promise<string> {
  return ensureDefaultUser();
}
