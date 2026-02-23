import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { isAdminUser } from '@/lib/auth/admin';

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ authenticated: false, isAdmin: false }, { status: 200 });
    }

    return NextResponse.json({
      authenticated: true,
      isAdmin: isAdminUser(user),
    });
  } catch (error) {
    console.error('Admin session check error:', error);
    return NextResponse.json({ authenticated: false, isAdmin: false }, { status: 200 });
  }
}

