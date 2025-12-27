import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { getSessionUser } from '@/lib/auth/session';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema for creating/updating projects
const projectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(['idea', 'in_progress', 'completed', 'archived']).optional(),
  coverImageUrl: z.string().url().optional().or(z.literal('')),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  bpmLock: z.number().positive().optional().or(z.null()),
  keyLock: z.string().max(20).optional().or(z.null()),
});

// GET /api/projects - List all projects for the authenticated user
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, user.id))
      .orderBy(desc(projects.updatedAt));

    return NextResponse.json({ projects: userProjects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = projectSchema.parse(body);

    const [newProject] = await db
      .insert(projects)
      .values({
        userId: user.id,
        name: validatedData.name,
        description: validatedData.description,
        status: validatedData.status || 'in_progress',
        coverImageUrl: validatedData.coverImageUrl || null,
        color: validatedData.color || '#6366f1',
        bpmLock: validatedData.bpmLock?.toString() || null,
        keyLock: validatedData.keyLock || null,
      })
      .returning();

    return NextResponse.json({ project: newProject }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
