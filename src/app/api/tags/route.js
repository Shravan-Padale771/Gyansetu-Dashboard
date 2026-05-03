import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const options = {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.WIX_API_KEY,
        'wix-site-id': process.env.WIX_SITE_ID
      },
      body: JSON.stringify({}) // Empty query pulls everything
    };

    // Attempt to pull the tags from the Wix API
    let res = await fetch("https://www.wixapis.com/v3/tags/query", options);
    let data = await res.json();

    // Fallback just in case your Wix account uses the alternate API path
    if (!res.ok || !data.tags) {
       res = await fetch("https://www.wixapis.com/blog/v3/tags/query", options);
       data = await res.json();
    }

    if (data.tags) {
      const extractedTags = data.tags.map(t => ({ label: t.label, id: t.id }));
      return NextResponse.json({ 
        message: "SUCCESS! Copy the IDs below into your page.js file:", 
        your_tags: extractedTags 
      });
    }

    return NextResponse.json({ error: "Could not find tags.", rawData: data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}