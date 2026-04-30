import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// POST: Log the user in and set the cookie
export async function POST(req) {
    try {
        const { password } = await req.json();

        // Check if the password matches your .env.local
        if (password === process.env.ADMIN_PASSWORD) {
            // NEXT.JS 15 FIX: await the cookies object
            const cookieStore = await cookies();
            
            // Set a secure, HTTP-only cookie that lasts for 30 days
            cookieStore.set('admin_session', 'authenticated', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 60 * 60 * 24 * 30, // 30 days
                path: '/',
            });

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ error: "Auth failed" }, { status: 500 });
    }
}

// DELETE: Log the user out by destroying the cookie
export async function DELETE() {
    const cookieStore = await cookies();
    cookieStore.delete('admin_session');
    return NextResponse.json({ success: true });
}