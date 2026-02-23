import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/config';
import { getSessionUser } from '@/lib/auth/session';

type AdminUserLike = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
};

function parseCsv(value: string | undefined) {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseBool(value: string | undefined, fallback = false) {
  if (value == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function getAdminConfig() {
  return {
    adminUserIds: new Set(parseCsv(process.env.IMX_ADMIN_USER_IDS)),
    adminUserEmails: new Set(
      parseCsv(process.env.IMX_ADMIN_USER_EMAILS).map((email) => email.toLowerCase())
    ),
    devBypassEnabled: parseBool(process.env.IMX_DEV_ADMIN_BYPASS, process.env.NODE_ENV !== 'production'),
    devUserId: process.env.DEV_USER_ID || '00000000-0000-0000-0000-000000000001',
    devUserEmail: (process.env.DEV_USER_EMAIL || 'dev@example.com').toLowerCase(),
  };
}

export function isAdminUser(user: AdminUserLike | null | undefined) {
  if (!user) return false;
  const config = getAdminConfig();
  const userId = user.id ?? null;
  const email = user.email?.toLowerCase() ?? null;

  if (userId && config.adminUserIds.has(userId)) return true;
  if (email && config.adminUserEmails.has(email)) return true;

  if (config.devBypassEnabled && process.env.NODE_ENV !== 'production') {
    return userId === config.devUserId || email === config.devUserEmail;
  }

  return false;
}

export async function requireAdminApiUser(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  if (!isAdminUser(user)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return { ok: true as const, user };
}

export async function requireServerAdminUser() {
  const headerStore = await headers();
  const session = await auth.api.getSession({ headers: headerStore });
  const user = session?.user ?? null;

  if (user && isAdminUser(user)) {
    return user;
  }

  if (process.env.NODE_ENV !== 'production' && getAdminConfig().devBypassEnabled) {
    return {
      id: process.env.DEV_USER_ID || '00000000-0000-0000-0000-000000000001',
      email: process.env.DEV_USER_EMAIL || 'dev@example.com',
      name: process.env.DEV_USER_NAME || 'Dev User',
    };
  }

  return null;
}

