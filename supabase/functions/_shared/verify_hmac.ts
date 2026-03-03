export async function verifyWebhookSignature(req: Request, secret: string) {
    const signatureHeader = req.headers.get("x-webhook-signature") || req.headers.get("x-supabase-signature");
    if (!signatureHeader) return false;

    const reqHtml = await req.clone().text();

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
    );

    const signatureBytes = new Uint8Array(
        signatureHeader.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    return await crypto.subtle.verify(
        "HMAC",
        key,
        signatureBytes,
        encoder.encode(reqHtml)
    );
}
