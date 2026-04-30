import { NextResponse } from 'next/server';

const headers = {
    'Content-Type': 'application/json',
    'Authorization': process.env.WIX_API_KEY,
    'wix-site-id': process.env.WIX_SITE_ID
};

// GET: Fetch all published blogs
export async function GET() {
    try {
        const res = await fetch('https://www.wixapis.com/blog/v3/posts', { method: 'GET', headers, cache: 'no-store' });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// POST: Create and Publish a new blog
export async function POST(req) {
    try {
        const body = await req.json(); 
        
        // Auto-fetch the Author ID from your existing posts
        const postsRes = await fetch('https://www.wixapis.com/blog/v3/posts?paging.limit=1', { headers });
        const postsData = await postsRes.json();
        const authorId = postsData.posts?.[0]?.memberId || postsData.posts?.[0]?.authorId;

        if (!authorId) {
            return NextResponse.json({ error: "Author ID missing", details: "Publish at least one blog on Wix first." }, { status: 400 });
        }
        
        body.post.memberId = authorId;

        const wixPayload = {
            draftPost: body.post,
            publish: true 
        };

        const createRes = await fetch('https://www.wixapis.com/blog/v3/draft-posts', { 
            method: 'POST', 
            headers, 
            body: JSON.stringify(wixPayload) 
        });

        if (!createRes.ok) {
            const errorText = await createRes.text();
            return NextResponse.json({ error: "Wix rejected the post", details: errorText }, { status: createRes.status });
        }

        const newPost = await createRes.json();
        return NextResponse.json({ success: true, post: newPost });
        
    } catch (error) {
        return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
    }
}