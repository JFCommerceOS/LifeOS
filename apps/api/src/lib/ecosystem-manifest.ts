import { prisma } from '@life-os/database';

/** Static + dynamic ecosystem manifest for multi-shell clients (Phase 7). */
export async function buildEcosystemManifest(userId: string) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const deviceCount = await prisma.edgeDevice.count({ where: { userId } });

  return {
    version: 1,
    continuityCore: 'server_api',
    continuityNote:
      'Dev/MVP core is this API + DB. Phone-first local memory is the product target; tile/watch use redacted surface APIs only.',
    shells: {
      phone: {
        role: 'phone',
        ui: 'full',
        cache: ['operational_memory', 'recent_context', 'suggestions'],
      },
      watch: {
        role: 'watch',
        ui: 'micro_actions',
        cache: ['due_now', 'pending_suggestion_ids', 'brief_snippet'],
        boundaries:
          'No full archive; use /companion/watch and suggestion actions only unless sync expands scope.',
      },
      accessory: {
        role: 'accessory',
        ui: 'signal_capture',
        cache: ['tiny_prompt', 'voice_stub'],
        boundaries: 'No full archive access by default.',
      },
      private_node: {
        role: 'private_node',
        ui: 'coordinator',
        cache: ['cold_archive', 'backup', 'heavy_summaries'],
        boundaries: 'User-owned LAN/VPN; optional sync coordinator — not a cloud dependency.',
      },
      ambient_tile: {
        role: 'ambient_tile',
        ui: 'glance_instrument',
        cache: ['tile_display_model', 'last_mode'],
        feed: '/api/v1/surfaces/tile/current',
        boundaries:
          'Not the brain; no raw connectors; no dense dashboards; use TileDisplayModel only. Calm, redacted, max two content blocks.',
      },
    },
    sync: {
      cloudRequired: false,
      encryptedTransport:
        'Use HTTPS/TLS on your network; optional payload encryption between devices is a future layer.',
      deviceSyncOptIn: settings?.deviceSyncOptIn ?? false,
      excludedModules: safeJson<string[]>(settings?.syncExcludedModulesJson, []),
      registeredDevices: deviceCount,
    },
  };
}

function safeJson<T>(raw: string | undefined, fallback: T): T {
  try {
    return JSON.parse(raw ?? '[]') as T;
  } catch {
    return fallback;
  }
}
