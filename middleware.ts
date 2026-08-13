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

  // API routes: return a real 401 JSON response instead of redirecting.
  // Browsers follow redirects silently by default, so a fetch() to e.g.
  // PATCH /api/admin-table with an expired session cookie was previously
  // getting redirected to /login (HTML, status 200) -- which satisfies
  // `res.ok` on the calling code, so every write button in the app would
  // report success and update its local UI state while nothing had
  // actually reached the database. Found via a real report: "Set as
  // reference" on species photos appeared to work but never persisted.
  // This affects every /api/** write route the same way, not just that
  // one button, so the fix belongs here rather than in each caller.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not authenticated -- session expired, please log in again' }, { status: 401 })
  }

  const loginUrl = new URL('/login', request.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.png|api/login).*)',
  ],
}
