import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function decodeJwt(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload);
  } catch (e) {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Bypass system, static assets, public pages, and the dev sandbox
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/dev')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('kaushal_token')?.value || request.cookies.get('token')?.value;
  let userRole: string | null = null;

  if (token) {
    const payload = decodeJwt(token);
    if (payload && payload.role) {
      userRole = payload.role;
    }
  }

  const prefixes = ['/student', '/company', '/faculty', '/tp', '/hod'];
  const matchedPrefix = prefixes.find(prefix => pathname.startsWith(prefix));

  if (matchedPrefix) {
    // Map path prefix '/tp' to the backend Role enum value 'tnp'
    const requiredRole = matchedPrefix === '/tp' ? 'tnp' : matchedPrefix.slice(1);
    if (!userRole || userRole !== requiredRole) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
