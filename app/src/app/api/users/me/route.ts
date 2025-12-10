import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { updateProfileSchema } from '@/lib/utils/validation';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';

// GET /api/users/me - Get current user profile
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        username: users.username,
        emailVerified: users.emailVerified,
        image: users.image,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user[0]);
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/users/me - Update current user profile
export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { username, email, name } = updateProfileSchema.parse(body);

    // Check if email is already taken by another user
    if (email && email !== session.user.email) {
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        return NextResponse.json(
          { error: 'Email already taken' },
          { status: 409 }
        );
      }
    }

    // Update user
    const updatedUser = await db
      .update(users)
      .set({
        name: name || undefined,
        username: username || undefined,
        email: email || undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        username: users.username,
        emailVerified: users.emailVerified,
        image: users.image,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return NextResponse.json(updatedUser[0]);
  } catch (error) {
    console.error('Update user error:', error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/me - Delete current user account
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required for account deletion' },
        { status: 400 }
      );
    }

    // Verify password by attempting sign in
    try {
      await auth.api.signInEmail({
        body: {
          email: session.user.email,
          password,
        },
        headers: request.headers,
      });
    } catch {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Clean up all user files from R2 storage before deleting from database
    const { getStorage } = await import('@/lib/storage');
    const { uploadedTracks, trackStems, mashups } = await import('@/lib/db/schema');
    const { log } = await import('@/lib/logger');
    const storage = await getStorage();
    const userId = session.user.id;

    // Get all tracks owned by user
    const userTracks = await db
      .select({ id: uploadedTracks.id, storageUrl: uploadedTracks.storageUrl })
      .from(uploadedTracks)
      .where(eq(uploadedTracks.userId, userId));

    // Delete all stem files for user's tracks
    for (const track of userTracks) {
      const stems = await db
        .select({ id: trackStems.id, storageUrl: trackStems.storageUrl })
        .from(trackStems)
        .where(eq(trackStems.uploadedTrackId, track.id));

      for (const stem of stems) {
        if (stem.storageUrl) {
          try {
            await storage.deleteFile(stem.storageUrl);
          } catch (error) {
            log('warn', 'user.delete.stem.failed', { userId, stemId: stem.id, error: (error as Error).message });
          }
        }
      }

      // Delete track file
      if (track.storageUrl) {
        try {
          await storage.deleteFile(track.storageUrl);
        } catch (error) {
          log('warn', 'user.delete.track.failed', { userId, trackId: track.id, error: (error as Error).message });
        }
      }
    }

    // Get all mashups owned by user
    const userMashups = await db
      .select({ 
        id: mashups.id, 
        outputStorageUrl: mashups.outputStorageUrl,
        previewStorageUrl: mashups.previewStorageUrl,
      })
      .from(mashups)
      .where(eq(mashups.userId, userId));

    // Delete all mashup files
    for (const mashup of userMashups) {
      if (mashup.outputStorageUrl) {
        try {
          await storage.deleteFile(mashup.outputStorageUrl);
        } catch (error) {
          log('warn', 'user.delete.mashup.output.failed', { userId, mashupId: mashup.id, error: (error as Error).message });
        }
      }
      if (mashup.previewStorageUrl) {
        try {
          await storage.deleteFile(mashup.previewStorageUrl);
        } catch (error) {
          log('warn', 'user.delete.mashup.preview.failed', { userId, mashupId: mashup.id, error: (error as Error).message });
        }
      }
    }

    log('info', 'user.files.cleanup.complete', { 
      userId, 
      tracksDeleted: userTracks.length, 
      mashupsDeleted: userMashups.length 
    });

    // Delete user and all associated data (cascade handles DB relations)
    await db.delete(users).where(eq(users.id, userId));

    log('info', 'user.deleted', { userId });

    // Sign out the user
    const signOutResult = await auth.api.signOut({
      headers: request.headers,
    });

    const signOutResponse = signOutResult instanceof Response
      ? signOutResult
      : NextResponse.json(signOutResult);

    if (!signOutResponse.ok) {
      return signOutResponse;
    }

    const response = new NextResponse(null, { status: 204 });
    signOutResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        response.headers.append(key, value);
      }
    });

    return response;
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
