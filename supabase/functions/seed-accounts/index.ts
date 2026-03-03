import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    // SECURITY: Production guard — seeding wipes the entire user database.
    // Set SEED_ENABLED=true only in local/dev environments via Supabase secrets.
    if (Deno.env.get("SEED_ENABLED") !== "true") {
        return new Response(JSON.stringify({ error: "Seeding is disabled in this environment" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    // SECURITY: This endpoint wipes the entire user database.
    // Must only be callable with the service role key.
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
        return new Response(JSON.stringify({ error: "Unauthorized — service role key required" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const log: string[] = [];

    try {
        // ── Step 1: Delete all existing auth users ───────────────────────────────
        log.push("Listing existing auth users...");
        const { data: existingUsers, error: listErr } = await adminClient.auth.admin.listUsers();
        if (listErr) throw listErr;

        for (const u of existingUsers.users) {
            const { error: delErr } = await adminClient.auth.admin.deleteUser(u.id);
            if (delErr) {
                log.push(`  Warning: could not delete user ${u.email}: ${delErr.message}`);
            } else {
                log.push(`  Deleted: ${u.email}`);
            }
        }
        log.push(`Deleted ${existingUsers.users.length} existing users.`);

        // ── Step 2: Create Ali Saad (super_admin, business plan) ─────────────────
        log.push("Creating Ali Saad...");
        const { data: aliData, error: aliErr } = await adminClient.auth.admin.createUser({
            email: "alisaad75878@gmail.com",
            password: "Test123!",
            email_confirm: true,
            user_metadata: { full_name: "Ali Saad" },
        });
        if (aliErr) throw aliErr;
        const aliId = aliData.user.id;
        log.push(`  Created user: ${aliId}`);

        // Wait briefly for DB trigger to fire (handle_new_user)
        await new Promise((r) => setTimeout(r, 1500));

        // Update profile
        await adminClient
            .from("profiles")
            .update({ full_name: "Ali Saad", onboarding_completed: true })
            .eq("id", aliId);

        // Get Ali's workspace
        const { data: aliWorkspace } = await adminClient
            .from("workspaces")
            .select("id")
            .eq("owner_id", aliId)
            .single();

        if (aliWorkspace) {
            // Update workspace name, plan, and credits
            await adminClient
                .from("workspaces")
                .update({
                    name: "Ali Saad's Workspace",
                    plan: "business",
                    search_credits_remaining: 2000,
                    ai_credits_remaining: 500,
                    email_sends_remaining: 999,
                    enrichment_credits_remaining: 2000,
                })
                .eq("id", aliWorkspace.id);

            // Upsert subscription
            await adminClient.from("subscriptions").upsert(
                {
                    workspace_id: aliWorkspace.id,
                    plan: "business",
                    status: "active",
                    stripe_customer_id: `seed_ali_${aliId}`,
                    current_period_start: new Date().toISOString(),
                    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                },
                { onConflict: "workspace_id" }
            );
            log.push("  Workspace + subscription updated for Ali Saad.");
        }

        // Update app role to super_admin
        await adminClient
            .from("user_roles")
            .update({ role: "super_admin" })
            .eq("user_id", aliId);
        log.push("  Role set to super_admin.");

        // ── Step 3: Create Vecter Prime (user, pro plan) ──────────────────────────
        log.push("Creating Vecter Prime...");
        const { data: vecData, error: vecErr } = await adminClient.auth.admin.createUser({
            email: "vecterprime1234@gmail.com",
            password: "Test123!",
            email_confirm: true,
            user_metadata: { full_name: "Vecter Prime" },
        });
        if (vecErr) throw vecErr;
        const vecId = vecData.user.id;
        log.push(`  Created user: ${vecId}`);

        await new Promise((r) => setTimeout(r, 1500));

        // Update profile
        await adminClient
            .from("profiles")
            .update({ full_name: "Vecter Prime", onboarding_completed: true })
            .eq("id", vecId);

        // Get Vecter's workspace
        const { data: vecWorkspace } = await adminClient
            .from("workspaces")
            .select("id")
            .eq("owner_id", vecId)
            .single();

        if (vecWorkspace) {
            await adminClient
                .from("workspaces")
                .update({
                    name: "Vecter Prime's Workspace",
                    plan: "pro",
                    search_credits_remaining: 500,
                    ai_credits_remaining: 100,
                    email_sends_remaining: 100,
                    enrichment_credits_remaining: 500,
                })
                .eq("id", vecWorkspace.id);

            await adminClient.from("subscriptions").upsert(
                {
                    workspace_id: vecWorkspace.id,
                    plan: "pro",
                    status: "active",
                    stripe_customer_id: `seed_vec_${vecId}`,
                    current_period_start: new Date().toISOString(),
                    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                },
                { onConflict: "workspace_id" }
            );
            log.push("  Workspace + subscription updated for Vecter Prime.");
        }

        // Keep role as 'user' (default from trigger)
        log.push("  Role kept as user (default).");

        log.push("Seeding complete!");

        return new Response(JSON.stringify({ success: true, log }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err: any) {
        console.error("Seed error:", err);
        return new Response(
            JSON.stringify({ success: false, error: err.message, log }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
