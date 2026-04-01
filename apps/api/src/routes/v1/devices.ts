import type { EdgeDevice } from '@prisma/client';
import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { revokeDevice, setDeviceTrust } from '../../services/device-trust-service.js';

const pushReg = z
  .object({
    deviceType: z.string().min(1).max(64),
    appRuntimeType: z.string().min(1).max(64),
    pushTokenOrLocalDeviceKey: z.string().min(4).max(2048).optional(),
  })
  .optional();

const registerBody = z.object({
  clientDeviceId: z.string().min(8).max(128),
  label: z.string().min(1).max(120),
  role: z.enum(['phone', 'watch', 'accessory', 'private_node']),
  notificationRegistration: pushReg,
});

const patchDeviceBody = z
  .object({
    label: z.string().min(1).max(120).optional(),
    role: z.enum(['phone', 'watch', 'accessory', 'private_node']).optional(),
    notificationRegistration: pushReg,
  })
  .strict();

const trustBody = z
  .object({
    trustStatus: z.enum(['PENDING', 'TRUSTED', 'LIMITED', 'REVOKED']).optional(),
    trustLevel: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  })
  .strict();

async function runDeviceRegister(
  userId: string,
  body: z.infer<typeof registerBody>,
): Promise<{ row: EdgeDevice }> {
  const now = new Date();
  const row = await prisma.edgeDevice.upsert({
    where: {
      userId_clientDeviceId: { userId, clientDeviceId: body.clientDeviceId },
    },
    create: {
      userId,
      clientDeviceId: body.clientDeviceId,
      label: body.label,
      role: body.role,
      lastSeenAt: now,
      trustStatus: 'PENDING',
      enrolledAt: now,
    },
    update: {
      label: body.label,
      role: body.role,
      lastSeenAt: now,
    },
  });
  if (body.notificationRegistration) {
    const nr = body.notificationRegistration;
    await prisma.notificationDeviceRegistration.create({
      data: {
        userId,
        deviceType: nr.deviceType,
        appRuntimeType: nr.appRuntimeType,
        pushTokenOrLocalDeviceKey: nr.pushTokenOrLocalDeviceKey ?? body.clientDeviceId,
        lastSeenAt: now,
      },
    });
  }
  await writeAudit(userId, 'device.register', { entityType: 'EdgeDevice', entityId: row.id });
  return { row };
}

export async function registerDeviceRoutes(app: FastifyInstance) {
  app.get('/devices', async (_req, reply) => {
    const userId = await getUserId();
    const data = await prisma.edgeDevice.findMany({
      where: { userId },
      orderBy: [{ lastSeenAt: 'desc' }],
    });
    return reply.send({ data });
  });

  app.post('/devices/register', async (req, reply) => {
    const userId = await getUserId();
    const body = registerBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const { row } = await runDeviceRegister(userId, body.data);
    return reply.status(201).send({ device: row });
  });

  app.post('/devices/enroll', async (req, reply) => {
    const userId = await getUserId();
    const body = registerBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const { row } = await runDeviceRegister(userId, body.data);
    return reply.status(201).send({ device: row });
  });

  app.patch('/devices/:id/trust', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = trustBody.safeParse(req.body ?? {});
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const out = await setDeviceTrust({
      userId,
      deviceId: id,
      trustStatus: body.data.trustStatus,
      trustLevel: body.data.trustLevel,
    });
    if (!out.ok) return reply.status(404).send({ error: out.code });
    return reply.send({ device: out.device });
  });

  app.post('/devices/:id/revoke', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const ok = await revokeDevice(userId, id);
    if (!ok) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ ok: true });
  });

  app.patch('/devices/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const body = patchDeviceBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.edgeDevice.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    const now = new Date();
    const row = await prisma.edgeDevice.update({
      where: { id },
      data: {
        ...(body.data.label !== undefined ? { label: body.data.label } : {}),
        ...(body.data.role !== undefined ? { role: body.data.role } : {}),
        lastSeenAt: now,
      },
    });
    if (body.data.notificationRegistration) {
      const nr = body.data.notificationRegistration;
      await prisma.notificationDeviceRegistration.create({
        data: {
          userId,
          deviceType: nr.deviceType,
          appRuntimeType: nr.appRuntimeType,
          pushTokenOrLocalDeviceKey: nr.pushTokenOrLocalDeviceKey ?? existing.clientDeviceId,
          lastSeenAt: now,
        },
      });
    }
    await writeAudit(userId, 'device.patch', { entityType: 'EdgeDevice', entityId: id });
    return reply.send({ device: row });
  });

  app.delete('/devices/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const existing = await prisma.edgeDevice.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    await prisma.edgeDevice.delete({ where: { id } });
    await writeAudit(userId, 'device.delete', { entityType: 'EdgeDevice', entityId: id });
    return reply.status(204).send();
  });
}
