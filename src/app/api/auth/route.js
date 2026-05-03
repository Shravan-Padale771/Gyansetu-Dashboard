import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // Securely reading from the backend .env file
    const adminPassword = process.env.ADMIN_PASSWORD;
    const editorPassword = process.env.EDITOR_PASSWORD;

    if (!username || !password) {
      return NextResponse.json({ success: false, error: "Missing credentials" }, { status: 400 });
    }

    const cleanName = username.trim().toLowerCase();

    // Check Admin
    if (cleanName === "gyansetu" && password === adminPassword) {
      return NextResponse.json({ success: true, role: "admin", user: "GyanSetu" });
    } 
    // Check Editor
    else if (cleanName !== "gyansetu" && password === editorPassword) {
      return NextResponse.json({ success: true, role: "editor", user: cleanName });
    } 
    // Fail
    else {
      return NextResponse.json({ success: false, error: "Invalid username or password." }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}