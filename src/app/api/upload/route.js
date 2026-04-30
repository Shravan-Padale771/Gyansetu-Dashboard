import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get('image');

        if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

        const urlRes = await fetch('https://www.wixapis.com/site-media/v1/files/generate-upload-url', {
            method: 'POST',
            headers: {
                'Authorization': process.env.WIX_API_KEY,
                'wix-site-id': process.env.WIX_SITE_ID,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mimeType: file.type,
                fileName: file.name
            })
        });

        if (!urlRes.ok) {
            const errText = await urlRes.text();
            return NextResponse.json({ error: "Wix refused to generate an upload link", details: errText }, { status: urlRes.status });
        }

        const urlData = await urlRes.json();
        const fileBuffer = Buffer.from(await file.arrayBuffer());

        const uploadRes = await fetch(urlData.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: fileBuffer
        });

        if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            return NextResponse.json({ error: "Failed to put file on Wix server", details: errText }, { status: uploadRes.status });
        }

        const uploadedData = await uploadRes.json();

        // THE FIX: We must return the ID alongside the URL so the Blog API accepts it
        if (uploadedData.file && uploadedData.file.url) {
            return NextResponse.json({ 
                success: true, 
                url: uploadedData.file.url,
                id: uploadedData.file.id 
            });
        } else {
            return NextResponse.json({ error: "Upload succeeded but Wix format is wrong" }, { status: 500 });
        }

    } catch (error) {
        return NextResponse.json({ error: "Server crashed during upload", details: error.message }, { status: 500 });
    }
}