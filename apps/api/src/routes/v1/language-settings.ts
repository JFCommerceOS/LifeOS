import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { getOrCreateUserLanguagePreference, updateUserLanguagePreference } from '../../services/language-stack.js';

const patchBody = z
  .object({
    primaryUiLanguage: z.string().min(2).max(32).optional(),
    primaryAssistantLanguage: z.string().min(2).max(32).optional(),
    preferredSttLanguage: z.string().min(2).max(32).nullable().optional(),
    preferredTtsLanguage: z.string().min(2).max(32).nullable().optional(),
    secondaryLanguagesJson: z.string().optional(),
    allowAutoLocaleSwitch: z.boolean().optional(),
  })
  .strict();

async function assertUiLanguage(tag: string): Promise<boolean> {
  const row = await prisma.supportedLanguage.findUnique({ where: { languageTag: tag } });
  return Boolean(row?.uiSupported);
}

async function assertTypedAssistantLanguage(tag: string): Promise<boolean> {
  const row = await prisma.supportedLanguage.findUnique({ where: { languageTag: tag } });
  return Boolean(row?.typedSupported);
}

async function assertSttLanguage(tag: string): Promise<boolean> {
  const row = await prisma.supportedLanguage.findUnique({ where: { languageTag: tag } });
  return Boolean(row?.sttSupported);
}

async function assertTtsLanguage(tag: string): Promise<boolean> {
  const row = await prisma.supportedLanguage.findUnique({ where: { languageTag: tag } });
  return Boolean(row?.ttsSupported);
}

export async function registerLanguageSettingsRoutes(app: FastifyInstance) {
  app.get('/settings/language', async (_req, reply) => {
    const userId = await getUserId();
    const preference = await getOrCreateUserLanguagePreference(userId);
    return reply.send({ preference });
  });

  app.patch('/settings/language', async (req, reply) => {
    const userId = await getUserId();
    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const body = parsed.data;
    if (body.primaryUiLanguage) {
      if (!(await assertUiLanguage(body.primaryUiLanguage))) {
        return reply.status(400).send({
          error: { code: 'INVALID_LANGUAGE', message: `UI language not available: ${body.primaryUiLanguage}` },
        });
      }
    }
    if (body.primaryAssistantLanguage) {
      if (!(await assertTypedAssistantLanguage(body.primaryAssistantLanguage))) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_LANGUAGE',
            message: `Typed assistant language not available: ${body.primaryAssistantLanguage}`,
          },
        });
      }
    }
    if (body.preferredSttLanguage) {
      if (!(await assertSttLanguage(body.preferredSttLanguage))) {
        return reply.status(400).send({
          error: { code: 'INVALID_LANGUAGE', message: `STT not available for: ${body.preferredSttLanguage}` },
        });
      }
    }
    if (body.preferredTtsLanguage) {
      if (!(await assertTtsLanguage(body.preferredTtsLanguage))) {
        return reply.status(400).send({
          error: { code: 'INVALID_LANGUAGE', message: `TTS not available for: ${body.preferredTtsLanguage}` },
        });
      }
    }

    if (body.secondaryLanguagesJson) {
      try {
        const arr = JSON.parse(body.secondaryLanguagesJson) as unknown;
        if (!Array.isArray(arr) || !arr.every((x) => typeof x === 'string')) {
          return reply.status(400).send({
            error: { code: 'INVALID_JSON', message: 'secondaryLanguagesJson must be a JSON array of strings' },
          });
        }
        for (const tag of arr) {
          const lang = await prisma.supportedLanguage.findUnique({ where: { languageTag: tag } });
          if (!lang?.uiSupported) {
            return reply.status(400).send({
              error: { code: 'INVALID_LANGUAGE', message: `Secondary language not supported: ${tag}` },
            });
          }
        }
      } catch {
        return reply.status(400).send({
          error: { code: 'INVALID_JSON', message: 'secondaryLanguagesJson must be valid JSON' },
        });
      }
    }

    const preference = await updateUserLanguagePreference(userId, body);
    await writeAudit(userId, 'settings.language.patch', { meta: { fields: Object.keys(body) } });
    return reply.send({ preference });
  });
}
