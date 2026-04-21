import { createClient } from "@supabase/supabase-js";

type RoleType = "system_admin" | "super_admin" | "user";

type TokenResult = {
  email: string;
  userId: string;
  role: RoleType;
  accessToken: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function ensureUser(
  serviceClient: any,
  email: string,
  password: string,
): Promise<string> {
  const { data: usersData, error: listError } = await serviceClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  const existing = usersData.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    if (!existing.email_confirmed_at) {
      const { error: updateErr } = await serviceClient.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
        password,
      });
      if (updateErr) throw updateErr;
    }
    return existing.id;
  }

  const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw createError ?? new Error("Failed to create user");
  }

  return created.user.id;
}

async function ensureRole(
  serviceClient: any,
  userId: string,
  role: RoleType,
) {
  // The repo contains two historical shapes for `user_roles`:
  // - UNIQUE(user_id) with enum `app_role`
  // - UNIQUE(user_id, role) with text roles
  //
  // For local testing we support both by attempting the multi-role upsert,
  // then falling back to single-role semantics.
  const attempt1 = await serviceClient
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
  if (!attempt1.error) return;

  const attempt2 = await serviceClient
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id" });
  if (attempt2.error) throw attempt2.error;
}

async function signInWithPasswordOrMagicLink(args: {
  anonClient: any;
  serviceClient: any;
  email: string;
  password: string;
}): Promise<string> {
  const { anonClient, serviceClient, email, password } = args;

  const pw = await anonClient.auth.signInWithPassword({ email, password });
  if (!pw.error && pw.data.session?.access_token) {
    return pw.data.session.access_token;
  }

  // Password grant fallback: magic-link exchange to produce a session token
  const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkError || !linkData.properties?.email_otp) {
    throw pw.error ?? linkError ?? new Error("Unable to obtain token via password or magic link");
  }

  const otp = await anonClient.auth.verifyOtp({
    email,
    token: linkData.properties.email_otp,
    type: "magiclink",
  });

  if (otp.error || !otp.data.session?.access_token) {
    throw otp.error ?? new Error("Magic-link OTP verification failed");
  }

  return otp.data.session.access_token;
}

async function emitProjectAuthDiagnostics(baseUrl: string, anonKey: string) {
  try {
    const response = await fetch(`${baseUrl}/auth/v1/settings`, {
      headers: { apikey: anonKey },
    });

    if (!response.ok) {
      console.warn(`[auth-diagnostics] /auth/v1/settings returned ${response.status}`);
      return;
    }

    const settings = (await response.json()) as any;
    console.log("auth_settings", {
      external_email_enabled: settings.external?.email,
      disable_signup: settings.disable_signup,
      mailer_autoconfirm: settings.mailer_autoconfirm,
      security_update_password_require_reauthentication:
        settings.security_update_password_require_reauthentication,
    });
  } catch (error) {
    console.warn("[auth-diagnostics] failed", error);
  }
}

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const systemAdminEmail = process.env.TEST_SYSTEM_ADMIN_EMAIL ?? "sysadmin@mushin.work";
  const normalUserEmail = process.env.TEST_NORMAL_USER_EMAIL ?? "normaluser@mushin.work";
  const basePassword = requireEnv("TEST_USER_PASSWORD");

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await emitProjectAuthDiagnostics(supabaseUrl, anonKey);

  const systemAdminUserId = await ensureUser(serviceClient, systemAdminEmail, basePassword);
  const normalUserId = await ensureUser(serviceClient, normalUserEmail, basePassword);

  await ensureRole(serviceClient, systemAdminUserId, "system_admin");
  await ensureRole(serviceClient, normalUserId, "user");

  const systemAdminToken = await signInWithPasswordOrMagicLink({
    anonClient,
    serviceClient,
    email: systemAdminEmail,
    password: basePassword,
  });

  const normalUserToken = await signInWithPasswordOrMagicLink({
    anonClient,
    serviceClient,
    email: normalUserEmail,
    password: basePassword,
  });

  const output: { system_admin: TokenResult; normal_user: TokenResult } = {
    system_admin: {
      email: systemAdminEmail,
      userId: systemAdminUserId,
      role: "system_admin",
      accessToken: systemAdminToken,
    },
    normal_user: {
      email: normalUserEmail,
      userId: normalUserId,
      role: "user",
      accessToken: normalUserToken,
    },
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error("generate_test_token failed", error);
  process.exit(1);
});
