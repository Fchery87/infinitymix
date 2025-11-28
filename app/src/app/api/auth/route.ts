import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { registerSchema, loginSchema } from '@/lib/utils/validation';
import { ValidationError, AuthenticationError, ConflictError } from '@/lib/utils/error-handling';
import { authRateLimit } from '@/lib/utils/rate-limiting';
import { z } from 'zod';

export const POST = authRateLimit(async function POST(request: NextRequest) {
  const rateLimitResponse = authRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    
    const { action } = body;
    
    if (action === 'register') {
      return handleRegister(body, request);
    } else if (action === 'login') {
      return handleLogin(body, request);
    } else {
      throw new ValidationError('Invalid action');
    }
  } catch (error) {
    console.error('Auth error:', error);
    
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
});

async function handleRegister(body: any, request: NextRequest) {
  const { email, password, username } = registerSchema.parse(body);
  
  // Create user using Better Auth
  const user = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name: username,
    },
  });

  return NextResponse.json({ success: true, user });
}

async function handleLogin(body: any, request: NextRequest) {
  const { email, password } = loginSchema.parse(body);
  
  // Sign in using Better Auth
  const session = await auth.api.signInEmail({
    body: {
      email,
      password,
    },
  });

  return NextResponse.json({ success: true, session });
}
