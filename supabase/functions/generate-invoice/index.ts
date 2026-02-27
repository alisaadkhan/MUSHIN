import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb } from "https://cdn.skypack.dev/pdf-lib";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

        // We expect this to be called from the dashboard by the workspace or an admin
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // Using service key to write to storage if needed
        );

        const { payment_id } = await req.json();
        if (!payment_id) throw new Error("Payment ID is required");

        // Fetch payment details
        const { data: payment, error: fetchErr } = await supabase
            .from("payments")
            .select("*, campaigns(name), influencer_profiles(full_name, username), workspaces(name, billing_email)")
            .eq("id", payment_id)
            .single();

        if (fetchErr || !payment) throw new Error("Payment not found");

        // Create a simple PDF Invoice using pdf-lib
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([600, 800]);
        const { width, height } = page.getSize();

        page.drawText('INFLUENCE IQ - INVOICE', { x: 50, y: height - 50, size: 24, color: rgb(0.48, 0.22, 0.92) });
        page.drawText(`Invoice ID: ${payment.id.substring(0, 8).toUpperCase()}`, { x: 50, y: height - 90, size: 12 });
        page.drawText(`Date: ${new Date(payment.created_at).toLocaleDateString()}`, { x: 50, y: height - 110, size: 12 });
        page.drawText(`Status: ${payment.status.toUpperCase()}`, { x: 50, y: height - 130, size: 12 });

        page.drawText(`To: ${payment.influencer_profiles?.full_name || payment.influencer_profiles?.username}`, { x: 50, y: height - 170, size: 14 });
        page.drawText(`From: ${payment.workspaces?.name}`, { x: 350, y: height - 170, size: 14 });

        page.drawText(`Campaign: ${payment.campaigns?.name}`, { x: 50, y: height - 230, size: 14 });
        page.drawText(`Amount Due: $${payment.amount} ${payment.currency}`, { x: 50, y: height - 260, size: 18, color: rgb(0.1, 0.6, 0.3) });

        const pdfBytes = await pdfDoc.save();

        // Store in Supabase Storage
        const fileName = `invoices/${payment.id}.pdf`;

        // Attempt to upload logic (simplified, assuming 'documents' bucket exists)
        // For this boilerplate, returning base64 directly to client to download
        const b64 = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(pdfBytes))));

        // Update DB with reference
        // await supabase.from('payments').update({ invoice_url: fileName }).eq('id', payment.id);

        return new Response(JSON.stringify({
            success: true,
            message: "Invoice generated",
            pdf_base64: b64,
            filename: `invoice_${payment.id.substring(0, 8)}.pdf`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (err: any) {
        console.error("Generate Invoice Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
