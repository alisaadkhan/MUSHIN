-- Zero-Trust Validation: RLS Bypass Fix & Enforced Idempotency

-- The previous `restore_ai_credit` and `restore_email_credit` functioned as `SECURITY DEFINER` 
-- without any internal authorization check, permitting ANY authenticated user to pass ANY
-- workspace ID and increment credits out of bounds.

CREATE OR REPLACE FUNCTION public.restore_ai_credit(ws_id UUID, i_key TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cur_plan TEXT;
BEGIN
    -- [CRITICAL SECURITY FIX] Authorize caller owns or belongs to the workspace
    IF ws_id NOT IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized to manipulate this workspace credits';
    END IF;

    -- [CRITICAL ARCHITECTURE FIX] Idempotency Enforcement 
    -- We force the application layer to ALWAYS provide an i_key. Null keys fallback to risky non-idempotent states.
    IF i_key IS NULL THEN
         RAISE EXCEPTION 'Idempotency key (i_key) is explicitly required for non-destructive mutations';
    END IF;

    -- Atomic insert will raise unique violation exception if idempotency key exists, averting race conditions seamlessly
    INSERT INTO public.refund_idempotency_keys (idempotency_key, workspace_id, refund_type)
    VALUES (i_key, ws_id, 'ai');

    SELECT plan INTO cur_plan FROM public.subscriptions WHERE workspace_id = ws_id AND status = 'active';
    -- Unlimited plans do not get credit refunds
    IF cur_plan = 'enterprise' OR cur_plan = 'unlimited' THEN
        RETURN;
    END IF;

    UPDATE public.workspaces
    SET ai_credits_remaining = ai_credits_remaining + 1
    WHERE id = ws_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.restore_email_credit(ws_id UUID, i_key TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cur_plan TEXT;
BEGIN
    -- [CRITICAL SECURITY FIX] Authorize caller owns or belongs to the workspace
    IF ws_id NOT IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized to manipulate this workspace credits';
    END IF;

    -- [CRITICAL ARCHITECTURE FIX] Idempotency Enforcement
    IF i_key IS NULL THEN
         RAISE EXCEPTION 'Idempotency key (i_key) is explicitly required for non-destructive mutations';
    END IF;

    -- Atomic insert will raise unique violation exception if idempotency key exists
    INSERT INTO public.refund_idempotency_keys (idempotency_key, workspace_id, refund_type)
    VALUES (i_key, ws_id, 'email');

    SELECT plan INTO cur_plan FROM public.subscriptions WHERE workspace_id = ws_id AND status = 'active';
    IF cur_plan = 'enterprise' OR cur_plan = 'unlimited' THEN
        RETURN;
    END IF;

    UPDATE public.workspaces
    SET email_sends_remaining = email_sends_remaining + 1
    WHERE id = ws_id;
END;
$$;
