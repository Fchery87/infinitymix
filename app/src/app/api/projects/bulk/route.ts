import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { getSessionUser } from '@/lib/auth/session';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

const bulkUpdateSchema = z.object({
  projectIds: z.array(z.string().uuid()).min(1),
  status: z.enum(['idea', 'in_progress', 'completed', 'archived']).optional(),
  isPinned: z.boolean().optional(),
});

// PATCH /api/projects/bulk - Bulk update projects
export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = bulkUpdateSchema.parse(body);

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (validatedData.status !== undefined)
      updateData.status = validatedData.status;
    if (validatedData.isPinned !== undefined)
      updateData.isPinned = validatedData.isPinned;

    const updatedProjects = await db
      .update(projects)
      .set(updateData)
      .where(
        and(
          eq(projects.userId, user.id),
          inArray(projects.id, validatedData.projectIds)
        )
      )
      .returning();

    return NextResponse.json({ projects: updatedProjects });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error bulk updating projects:', error);
    return NextResponse.json(
      { error: 'Failed to update projects' },
      { status: 500 }
    );
  }
}
