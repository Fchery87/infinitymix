import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { adminAuditLogs } from '@/lib/db/schema';
import type { AudioRolloutDomain, AudioRolloutOverride, AudioRolloutVariant } from './rollouts';

const AUDIO_ROLLOUT_RESOURCE_TYPE = 'audio_rollout';
const AUDIO_ROLLOUT_SET_ACTION = 'audio_rollout_override.set';
const AUDIO_ROLLOUT_CLEAR_ACTION = 'audio_rollout_override.clear';

type RolloutOverrideMetadata = {
  domain?: unknown;
  variant?: unknown;
  reason?: unknown;
};

function parseDomain(value: unknown): AudioRolloutDomain | null {
  return value === 'section_tagging' || value === 'planner' ? value : null;
}

function parseVariant(value: unknown): AudioRolloutVariant | null {
  return value === 'control' || value === 'candidate' ? value : null;
}

export async function getAudioRolloutOverrides(): Promise<
  Record<AudioRolloutDomain, AudioRolloutOverride | null>
> {
  const rows = await db
    .select()
    .from(adminAuditLogs)
    .where(eq(adminAuditLogs.resourceType, AUDIO_ROLLOUT_RESOURCE_TYPE))
    .orderBy(desc(adminAuditLogs.createdAt))
    .limit(200);

  const latest: Record<AudioRolloutDomain, AudioRolloutOverride | null> = {
    section_tagging: null,
    planner: null,
  };

  for (const row of rows) {
    const metadata = (row.metadata ?? {}) as RolloutOverrideMetadata;
    const domain = parseDomain(metadata.domain);
    if (!domain || latest[domain]) continue;

    if (row.action === AUDIO_ROLLOUT_CLEAR_ACTION) {
      latest[domain] = null;
      continue;
    }

    if (row.action !== AUDIO_ROLLOUT_SET_ACTION) continue;
    const variant = parseVariant(metadata.variant);
    if (!variant) continue;

    latest[domain] = {
      domain,
      variant,
      reason: typeof metadata.reason === 'string' ? metadata.reason : null,
      updatedAt: row.createdAt.toISOString(),
      adminUserEmail: row.adminUserEmail ?? null,
    };
  }

  return latest;
}

export async function setAudioRolloutOverride(args: {
  adminUserId?: string | null;
  adminUserEmail?: string | null;
  domain: AudioRolloutDomain;
  variant: AudioRolloutVariant;
  reason?: string | null;
}) {
  await db.insert(adminAuditLogs).values({
    adminUserId: args.adminUserId ?? null,
    adminUserEmail: args.adminUserEmail ?? null,
    action: AUDIO_ROLLOUT_SET_ACTION,
    resourceType: AUDIO_ROLLOUT_RESOURCE_TYPE,
    resourceIds: [args.domain],
    metadata: {
      domain: args.domain,
      variant: args.variant,
      reason: args.reason ?? null,
    },
  });
}

export async function clearAudioRolloutOverride(args: {
  adminUserId?: string | null;
  adminUserEmail?: string | null;
  domain: AudioRolloutDomain;
  reason?: string | null;
}) {
  await db.insert(adminAuditLogs).values({
    adminUserId: args.adminUserId ?? null,
    adminUserEmail: args.adminUserEmail ?? null,
    action: AUDIO_ROLLOUT_CLEAR_ACTION,
    resourceType: AUDIO_ROLLOUT_RESOURCE_TYPE,
    resourceIds: [args.domain],
    metadata: {
      domain: args.domain,
      reason: args.reason ?? null,
    },
  });
}
