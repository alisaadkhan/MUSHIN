-- Credits System Hardening — April 2026
-- Fixes identified during full system audit:
-- 1. restore_email_credit ceiling enforcement
-- 2. restore_ai_credit ceiling enforcement (already applied in 20260323, re-stated here for completeness)

-- ─── restore_email_credit — with ceiling enforcement ─────────────────────
CREATE OR REPLACE FUNCTION public.restore_email_credit(ws_id UUID, i_key TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cur_plan TEXT;
    v_current int;
    v_max int;
BEGIN
    IF i_key IS NOT NULL THEN
        -- Atomic insert will raise unique violation exception if idempotency key exists
        INSERT INTO public.refund_idempotency_keys (idempotency_key, workspace_id, refund_type)
        VALUES (i_key, ws_id, 'email');
    END IF;

    SELECT plan, email_sends_remaining
    INTO cur_plan, v_current
    FROM public.workspaces
    WHERE id = ws_id;

    IF cur_plan IS NULL THEN
        RETURN; -- workspace not found
    END IF;

    -- Cap restoration at the plan's email credit maximum to prevent farming
    v_max := CASE cur_plan
        WHEN 'free'       THEN 10
        WHEN 'starter'    THEN 100
        WHEN 'pro'        THEN 500
        WHEN 'business'   THEN 1500
        WHEN 'enterprise' THEN 9999
        WHEN 'unlimited'  THEN 9999
        ELSE 10
    END;

    IF v_current >= v_max THEN
        RETURN; -- already at or above max, don't restore further
    END IF;

    UPDATE public.workspaces
    SET email_sends_remaining = LEAST(v_current + 1, v_max)
    WHERE id = ws_id;
END;
$$;

-- Ensure only service_role can call restore functions
REVOKE EXECUTE ON FUNCTION public.restore_email_credit(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_email_credit(uuid, text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.restore_email_credit(uuid, text) TO service_role;
