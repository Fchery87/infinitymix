import { db } from '@/lib/db';
import { adminAuditLogs } from '@/lib/db/schema';

type AdminAuditEvent = {
  adminUserId?: string | null;
  adminUserEmail?: string | null;
  action: string;
  resourceType: string;
  resourceIds?: string[];
  metadata?: Record<string, unknown>;
};

export async function recordAdminAuditLog(event: AdminAuditEvent) {
  await db.insert(adminAuditLogs).values({
    adminUserId: event.adminUserId ?? null,
    adminUserEmail: event.adminUserEmail ?? null,
    action: event.action,
    resourceType: event.resourceType,
    resourceIds: event.resourceIds ?? [],
    metadata: event.metadata ?? null,
  });
}

