import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get('admin_auth')

  if (authCookie?.value === process.env.ADMIN_PASSWORD) {
    return NextResponse.next()
  }

  if (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/api/login') {
    return NextResponse.next()
  }

  const loginUrl = new URL('/login', request.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.png|api/login).*)',
  ],
}