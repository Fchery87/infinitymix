import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { registerSchema, loginSchema, type RegisterRequest, type LoginRequest } from '@/lib/utils/validation';
import { ValidationError, AuthenticationError, ConflictError } from '@/lib/utils/error-handling';
import { authRateLimit } from '@/lib/utils/rate-limiting';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  const rateLimitResponse = authRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();

    const { action } = body;

    if (action === 'register') {
      return await handleRegister(body, request);
    }
    if (action === 'login') {
      return await handleLogin(body, request);
    }

    throw new ValidationError('Invalid action');
  } catch (error) {
    console.error('Auth error:', error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.details, message: error.message },
        { status: 400 }
      );
    }

    if (error instanceof ConflictError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleRegister(body: unknown, request: NextRequest) {
  const { email, password, name, username } = registerSchema.parse(body as RegisterRequest);

  const response = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name,
    },
    headers: request.headers,
  });

  try {
    const cloned = response.clone();
    const payload = await cloned.json();
    const createdUser = payload?.user;

    if (createdUser?.id) {
      await db
        .update(users)
        .set({
          username: username || name,
          name,
          updatedAt: new Date(),
        })
        .where(eq(users.id, createdUser.id));
    }
  } catch (error) {
    console.error('Failed to sync user profile after registration', error);
  }

  return response;
}

async function handleLogin(body: unknown, request: NextRequest) {
  const { email, password } = loginSchema.parse(body as LoginRequest);

  const response = await auth.api.signInEmail({
    body: {
      email,
      password,
    },
    headers: request.headers,
  });

  return response;
}
