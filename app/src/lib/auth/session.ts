import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const DEV_USER_ID = process.env.DEV_USER_ID || '00000000-0000-0000-0000-000000000001';
const DEV_EMAIL = process.env.DEV_USER_EMAIL || 'dev@example.com';
const DEV_NAME = process.env.DEV_USER_NAME || 'Dev User';

async function ensureDevUser() {
  try {
    const existing = await db.select().from(users).where(eq(users.id, DEV_USER_ID)).limit(1);
    if (existing.length > 0) {
      return existing[0];
    }

    const [created] = await db
      .insert(users)
      .values({
        id: DEV_USER_ID,
        email: DEV_EMAIL,
        name: DEV_NAME,
        username: 'devuser',
      })
      .returning();

    return created;
  } catch {
    return null;
  }
}

export async function getSessionUser(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session) return session.user;

  if (process.env.NODE_ENV !== 'production') {
    const devUser = await ensureDevUser();
    if (devUser) {
      return { id: devUser.id, email: devUser.email ?? undefined, name: devUser.name ?? undefined };
    }
  }

  return null;
}
