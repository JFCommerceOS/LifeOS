import type { Person } from '@prisma/client';
import { prisma } from '@life-os/database';

export async function findPersonByNameOrAlias(userId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const byAlias = await prisma.personAlias.findFirst({
    where: {
      aliasText: { equals: trimmed, mode: 'insensitive' },
      person: { userId },
    },
    include: { person: true },
  });
  if (byAlias) return byAlias.person;

  return prisma.person.findFirst({
    where: { userId, name: { equals: trimmed, mode: 'insensitive' } },
  });
}

export async function createPersonWithAlias(
  userId: string,
  displayName: string,
  sourceType: string,
): Promise<Person> {
  const person = await prisma.person.create({
    data: {
      userId,
      name: displayName.trim().slice(0, 200),
      personType: 'INDIVIDUAL',
      importanceLevel: 'NORMAL',
      importance: 3,
    },
  });
  await prisma.personAlias.create({
    data: {
      personId: person.id,
      aliasText: displayName.trim().slice(0, 200),
      sourceType,
    },
  });
  return person;
}
