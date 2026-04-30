import { NextResponse } from 'next/server';

export function middleware(request) {
    const path = request.nextUrl.pathname;
    
    // Check if the secure cookie exists on this device
    const isAuth = request.cookies.has('admin_session');

    // 1. If they try to access the dashboard without the cookie, kick them to login
    if (path === '/' && !isAuth) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 2. If they are already logged in, don't let them see the login page
    if (path === '/login' && isAuth) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // 3. Protect all backend APIs so hackers can't bypass the UI
    if (path.startsWith('/api/') && !path.startsWith('/api/auth') && !isAuth) {
        return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    return NextResponse.next();
}

// Tell the middleware exactly which routes it needs to monitor
export const config = {
    matcher: ['/', '/login', '/api/:path*'],
};