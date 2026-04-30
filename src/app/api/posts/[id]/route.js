import { NextResponse } from 'next/server';

const headers = {
    'Content-Type': 'application/json',
    'Authorization': process.env.WIX_API_KEY,
    'wix-site-id': process.env.WIX_SITE_ID
};

// GET: Fetch a single, FULL blog post
export async function GET(req, { params }) {
    try {
        // NEXT.JS 15 FIX: Unwrap the params Promise first
        const unwrappedParams = await params;
        
        // THE FIX: We MUST explicitly demand 'RICH_CONTENT' from Wix, otherwise they hide the main blog text!
        const res = await fetch(`https://www.wixapis.com/blog/v3/posts/${unwrappedParams.id}?fieldsets=RICH_CONTENT`, { 
            method: 'GET', headers, cache: 'no-store' 
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }
}

// PATCH: Update an existing blog
export async function PATCH(req, { params }) {
    try {
        const unwrappedParams = await params;
        
        const body = await req.json();
        const wixPayload = { draftPost: body.post };

        const updateRes = await fetch(`https://www.wixapis.com/blog/v3/draft-posts/${unwrappedParams.id}`, { 
            method: 'PATCH', 
            headers, 
            body: JSON.stringify(wixPayload) 
        });

        if (!updateRes.ok) {
            const errText = await updateRes.text();
            return NextResponse.json({ error: "Update failed", details: errText }, { status: updateRes.status });
        }

        await fetch(`https://www.wixapis.com/blog/v3/draft-posts/${unwrappedParams.id}/publish`, { 
            method: 'POST', 
            headers,
            body: JSON.stringify({}) 
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
}

// DELETE: Remove a blog
export async function DELETE(req, { params }) {
    try {
        const unwrappedParams = await params;
        
        await fetch(`https://www.wixapis.com/blog/v3/draft-posts/${unwrappedParams.id}`, { 
            method: 'DELETE', headers 
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }
}