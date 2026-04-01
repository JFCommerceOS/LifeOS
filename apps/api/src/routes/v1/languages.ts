import type { FastifyInstance } from 'fastify';
import {
  getSupportedLanguageByTag,
  listSupportedLanguages,
  toCapabilitySummary,
} from '../../services/language-stack.js';

export async function registerLanguageRoutes(app: FastifyInstance) {
  app.get('/languages', async (_req, reply) => {
    const languages = await listSupportedLanguages();
    return reply.send({
      languages: languages.map((l) => ({
        id: l.id,
        languageTag: l.languageTag,
        displayName: l.displayName,
        nativeDisplayName: l.nativeDisplayName,
        regionGroup: l.regionGroup,
        uiSupported: l.uiSupported,
        typedSupported: l.typedSupported,
        sttSupported: l.sttSupported,
        ttsSupported: l.ttsSupported,
        s2sSupported: l.s2sSupported,
        qualityTier: l.qualityTier,
        rolloutState: l.rolloutState,
        preferredProvidersJson: l.preferredProvidersJson,
        notes: l.notes,
        providerPolicies: l.providerPolicies,
      })),
    });
  });

  app.get('/languages/:languageTag', async (req, reply) => {
    const { languageTag } = req.params as { languageTag: string };
    const decoded = decodeURIComponent(languageTag);
    const lang = await getSupportedLanguageByTag(decoded);
    if (!lang) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Unknown language tag' } });
    return reply.send({ language: lang });
  });

  app.get('/languages/:languageTag/capabilities', async (req, reply) => {
    const { languageTag } = req.params as { languageTag: string };
    const decoded = decodeURIComponent(languageTag);
    const lang = await getSupportedLanguageByTag(decoded);
    if (!lang) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Unknown language tag' } });
    return reply.send({
      capabilities: toCapabilitySummary(lang),
    });
  });
}
