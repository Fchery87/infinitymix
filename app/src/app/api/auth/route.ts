import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { registerSchema, loginSchema } from '@/lib/utils/validation';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get the action from the request
    const { action } = body;
    
    if (action === 'register') {
      return handleRegister(body);
    } else if (action === 'login') {
      return handleLogin(body);
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleRegister(body: any) {
  try {
    const { email, password, username } = registerSchema.parse(body);
    
    // Create user using Better Auth
    const user = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: username,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = error.message as string;
      if (errorMessage.includes('already exists')) {
        return NextResponse.json(
          { error: 'Email already registered' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}

async function handleLogin(body: any) {
  try {
    const { email, password } = loginSchema.parse(body);
    
    // Sign in using Better Auth
    const session = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
    });

    return NextResponse.json(session);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }
}
