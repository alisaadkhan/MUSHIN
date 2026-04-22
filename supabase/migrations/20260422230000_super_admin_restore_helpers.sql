-- ============================================================================
-- Super Admin Recovery & Security System (Part 2: Restore Helpers)
-- Migration: 20260422230000_super_admin_restore_helpers.sql
-- ============================================================================

BEGIN;

-- 1) paddle_subscriptions restore helper
CREATE OR REPLACE FUNCTION public.restore_paddle_subscriptions_to_timestamp(p_timestamp timestamptz, p_dry_run boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_to_upsert bigint;
  v_to_delete bigint;
BEGIN
  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'id')::uuid AS id,
      (h.row_data->>'user_id')::uuid AS user_id,
      h.row_data->>'paddle_subscription_id' AS paddle_subscription_id,
      h.row_data->>'paddle_customer_id' AS paddle_customer_id,
      h.row_data->>'paddle_product_id' AS paddle_product_id,
      h.row_data->>'paddle_price_id' AS paddle_price_id,
      h.row_data->>'plan_name' AS plan_name,
      h.row_data->>'status' AS status,
      (h.row_data->>'current_period_start')::timestamptz AS current_period_start,
      (h.row_data->>'current_period_end')::timestamptz AS current_period_end,
      COALESCE((h.row_data->>'cancel_at_period_end')::boolean, false) AS cancel_at_period_end,
      (h.row_data->>'canceled_at')::timestamptz AS canceled_at,
      COALESCE((h.row_data->>'raw_paddle_data')::jsonb, '{}'::jsonb) AS raw_paddle_data,
      (h.row_data->>'created_at')::timestamptz AS created_at,
      (h.row_data->>'updated_at')::timestamptz AS updated_at
    FROM public.critical_row_history h
    WHERE h.table_name = 'paddle_subscriptions'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  ),
  current_ids AS (
    SELECT ps.id::text AS record_id
    FROM public.paddle_subscriptions ps
  ),
  desired_ids AS (
    SELECT d.id::text AS record_id FROM desired d
  )
  SELECT
    (SELECT count(*) FROM desired) AS to_upsert,
    (SELECT count(*) FROM current_ids ci LEFT JOIN desired_ids di ON di.record_id = ci.record_id WHERE di.record_id IS NULL) AS to_delete
  INTO v_to_upsert, v_to_delete;

  IF p_dry_run THEN
    RETURN jsonb_build_object('to_upsert', v_to_upsert, 'to_delete', v_to_delete);
  END IF;

  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'id')::uuid AS id,
      (h.row_data->>'user_id')::uuid AS user_id,
      h.row_data->>'paddle_subscription_id' AS paddle_subscription_id,
      h.row_data->>'paddle_customer_id' AS paddle_customer_id,
      h.row_data->>'paddle_product_id' AS paddle_product_id,
      h.row_data->>'paddle_price_id' AS paddle_price_id,
      h.row_data->>'plan_name' AS plan_name,
      h.row_data->>'status' AS status,
      (h.row_data->>'current_period_start')::timestamptz AS current_period_start,
      (h.row_data->>'current_period_end')::timestamptz AS current_period_end,
      COALESCE((h.row_data->>'cancel_at_period_end')::boolean, false) AS cancel_at_period_end,
      (h.row_data->>'canceled_at')::timestamptz AS canceled_at,
      COALESCE((h.row_data->>'raw_paddle_data')::jsonb, '{}'::jsonb) AS raw_paddle_data,
      (h.row_data->>'created_at')::timestamptz AS created_at,
      (h.row_data->>'updated_at')::timestamptz AS updated_at
    FROM public.critical_row_history h
    WHERE h.table_name = 'paddle_subscriptions'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  )
  INSERT INTO public.paddle_subscriptions (
    id, user_id, paddle_subscription_id, paddle_customer_id, paddle_product_id,
    paddle_price_id, plan_name, status, current_period_start, current_period_end,
    cancel_at_period_end, canceled_at, raw_paddle_data, created_at, updated_at
  )
  SELECT
    d.id, d.user_id, d.paddle_subscription_id, d.paddle_customer_id, d.paddle_product_id,
    d.paddle_price_id, d.plan_name, d.status, d.current_period_start, d.current_period_end,
    d.cancel_at_period_end, d.canceled_at, d.raw_paddle_data, COALESCE(d.created_at, now()), COALESCE(d.updated_at, now())
  FROM desired d
  ON CONFLICT (id) DO UPDATE SET
    user_id = excluded.user_id,
    paddle_subscription_id = excluded.paddle_subscription_id,
    paddle_customer_id = excluded.paddle_customer_id,
    paddle_product_id = excluded.paddle_product_id,
    paddle_price_id = excluded.paddle_price_id,
    plan_name = excluded.plan_name,
    status = excluded.status,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    canceled_at = excluded.canceled_at,
    raw_paddle_data = excluded.raw_paddle_data,
    updated_at = excluded.updated_at;

  DELETE FROM public.paddle_subscriptions ps
  WHERE NOT EXISTS (
    SELECT 1 FROM public.critical_row_history h
    WHERE h.table_name = 'paddle_subscriptions'
      AND h.record_id = ps.id::text
      AND h.created_at <= p_timestamp
  );

  RETURN jsonb_build_object('restored', true, 'to_upsert', v_to_upsert, 'deleted', v_to_delete);
END;
$$;

-- 2) usage_limits restore helper
CREATE OR REPLACE FUNCTION public.restore_usage_limits_to_timestamp(p_timestamp timestamptz, p_dry_run boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_to_upsert bigint;
  v_to_delete bigint;
BEGIN
  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'id')::uuid AS id,
      (h.row_data->>'user_id')::uuid AS user_id,
      (h.row_data->>'search_count')::bigint AS search_count,
      (h.row_data->>'monthly_limit')::bigint AS monthly_limit,
      (h.row_data->>'period_start')::timestamptz AS period_start,
      (h.row_data->>'period_end')::timestamptz AS period_end,
      COALESCE((h.row_data->>'alert_50_sent')::boolean, false) AS alert_50_sent,
      COALESCE((h.row_data->>'alert_80_sent')::boolean, false) AS alert_80_sent,
      COALESCE((h.row_data->>'alert_100_sent')::boolean, false) AS alert_100_sent,
      (h.row_data->>'updated_at')::timestamptz AS updated_at
    FROM public.critical_row_history h
    WHERE h.table_name = 'usage_limits'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  ),
  current_ids AS (
    SELECT ul.id::text AS record_id
    FROM public.usage_limits ul
  ),
  desired_ids AS (
    SELECT d.id::text AS record_id FROM desired d
  )
  SELECT
    (SELECT count(*) FROM desired) AS to_upsert,
    (SELECT count(*) FROM current_ids ci LEFT JOIN desired_ids di ON di.record_id = ci.record_id WHERE di.record_id IS NULL) AS to_delete
  INTO v_to_upsert, v_to_delete;

  IF p_dry_run THEN
    RETURN jsonb_build_object('to_upsert', v_to_upsert, 'to_delete', v_to_delete);
  END IF;

  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'id')::uuid AS id,
      (h.row_data->>'user_id')::uuid AS user_id,
      (h.row_data->>'search_count')::bigint AS search_count,
      (h.row_data->>'monthly_limit')::bigint AS monthly_limit,
      (h.row_data->>'period_start')::timestamptz AS period_start,
      (h.row_data->>'period_end')::timestamptz AS period_end,
      COALESCE((h.row_data->>'alert_50_sent')::boolean, false) AS alert_50_sent,
      COALESCE((h.row_data->>'alert_80_sent')::boolean, false) AS alert_80_sent,
      COALESCE((h.row_data->>'alert_100_sent')::boolean, false) AS alert_100_sent,
      (h.row_data->>'updated_at')::timestamptz AS updated_at
    FROM public.critical_row_history h
    WHERE h.table_name = 'usage_limits'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  )
  INSERT INTO public.usage_limits (
    id, user_id, search_count, monthly_limit, period_start, period_end,
    alert_50_sent, alert_80_sent, alert_100_sent, updated_at
  )
  SELECT
    d.id, d.user_id, d.search_count, d.monthly_limit, d.period_start, d.period_end,
    d.alert_50_sent, d.alert_80_sent, d.alert_100_sent, COALESCE(d.updated_at, now())
  FROM desired d
  ON CONFLICT (id) DO UPDATE SET
    user_id = excluded.user_id,
    search_count = excluded.search_count,
    monthly_limit = excluded.monthly_limit,
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    alert_50_sent = excluded.alert_50_sent,
    alert_80_sent = excluded.alert_80_sent,
    alert_100_sent = excluded.alert_100_sent,
    updated_at = excluded.updated_at;

  DELETE FROM public.usage_limits ul
  WHERE NOT EXISTS (
    SELECT 1 FROM public.critical_row_history h
    WHERE h.table_name = 'usage_limits'
      AND h.record_id = ul.id::text
      AND h.created_at <= p_timestamp
  );

  RETURN jsonb_build_object('restored', true, 'to_upsert', v_to_upsert, 'deleted', v_to_delete);
END;
$$;

-- 3) credit_transactions restore helper
-- Note: credit_transactions is immutable, so we only remove rows created after timestamp.
-- Balancing the user_credits table is also required.
CREATE OR REPLACE FUNCTION public.restore_credit_transactions_to_timestamp(p_timestamp timestamptz, p_dry_run boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_to_delete bigint;
  v_credits_to_recalc bigint;
BEGIN
  -- We don't "restore" immutable transactions, we only delete those that occurred after the timestamp.
  -- Then we recalculate the user_credits balance from the remaining transaction history.
  
  SELECT count(*) INTO v_to_delete
  FROM public.credit_transactions ct
  WHERE ct.created_at > p_timestamp;

  IF p_dry_run THEN
    RETURN jsonb_build_object('to_delete_transactions', v_to_delete);
  END IF;

  DELETE FROM public.credit_transactions WHERE created_at > p_timestamp;

  -- Recalculate user_credits balance from history
  WITH recalc AS (
    SELECT
      user_id,
      workspace_id,
      credit_type,
      SUM(CASE WHEN kind = 'credit' THEN amount ELSE -amount END) as new_balance
    FROM public.credit_transactions
    GROUP BY user_id, workspace_id, credit_type
  )
  UPDATE public.user_credits uc
  SET balance = greatest(0, r.new_balance),
      updated_at = now()
  FROM recalc r
  WHERE uc.user_id = r.user_id
    AND uc.workspace_id = r.workspace_id
    AND uc.credit_type = r.credit_type;

  -- Set balance to 0 for users who no longer have transactions after rollback
  UPDATE public.user_credits uc
  SET balance = 0, updated_at = now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.credit_transactions ct
    WHERE ct.user_id = uc.user_id
      AND ct.workspace_id = uc.workspace_id
      AND ct.credit_type = uc.credit_type
  );

  RETURN jsonb_build_object('restored', true, 'deleted_transactions', v_to_delete);
END;
$$;

-- 4) support_tickets restore helper
CREATE OR REPLACE FUNCTION public.restore_support_tickets_to_timestamp(p_timestamp timestamptz, p_dry_run boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_to_upsert bigint;
  v_to_delete bigint;
BEGIN
  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'id')::uuid AS id,
      (h.row_data->>'user_id')::uuid AS user_id,
      (h.row_data->>'workspace_id')::uuid AS workspace_id,
      h.row_data->>'subject' AS subject,
      h.row_data->>'description' AS description,
      h.row_data->>'priority' AS priority,
      h.row_data->>'status' AS status,
      h.row_data->>'category' AS category,
      h.row_data->>'admin_notes' AS admin_notes,
      (h.row_data->>'resolved_at')::timestamptz AS resolved_at,
      (h.row_data->>'created_at')::timestamptz AS created_at,
      (h.row_data->>'updated_at')::timestamptz AS updated_at,
      (h.row_data->>'ticket_number')::bigint AS ticket_number,
      (h.row_data->>'assigned_to')::uuid AS assigned_to,
      (h.row_data->>'assigned_at')::timestamptz AS assigned_at
    FROM public.critical_row_history h
    WHERE h.table_name = 'support_tickets'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  ),
  current_ids AS (
    SELECT st.id::text AS record_id
    FROM public.support_tickets st
  ),
  desired_ids AS (
    SELECT d.id::text AS record_id FROM desired d
  )
  SELECT
    (SELECT count(*) FROM desired) AS to_upsert,
    (SELECT count(*) FROM current_ids ci LEFT JOIN desired_ids di ON di.record_id = ci.record_id WHERE di.record_id IS NULL) AS to_delete
  INTO v_to_upsert, v_to_delete;

  IF p_dry_run THEN
    RETURN jsonb_build_object('to_upsert', v_to_upsert, 'to_delete', v_to_delete);
  END IF;

  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'id')::uuid AS id,
      (h.row_data->>'user_id')::uuid AS user_id,
      (h.row_data->>'workspace_id')::uuid AS workspace_id,
      h.row_data->>'subject' AS subject,
      h.row_data->>'description' AS description,
      h.row_data->>'priority' AS priority,
      h.row_data->>'status' AS status,
      h.row_data->>'category' AS category,
      h.row_data->>'admin_notes' AS admin_notes,
      (h.row_data->>'resolved_at')::timestamptz AS resolved_at,
      (h.row_data->>'created_at')::timestamptz AS created_at,
      (h.row_data->>'updated_at')::timestamptz AS updated_at,
      (h.row_data->>'ticket_number')::bigint AS ticket_number,
      (h.row_data->>'assigned_to')::uuid AS assigned_to,
      (h.row_data->>'assigned_at')::timestamptz AS assigned_at
    FROM public.critical_row_history h
    WHERE h.table_name = 'support_tickets'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  )
  INSERT INTO public.support_tickets (
    id, user_id, workspace_id, subject, description, priority, status, category,
    admin_notes, resolved_at, created_at, updated_at, ticket_number, assigned_to, assigned_at
  )
  SELECT
    d.id, d.user_id, d.workspace_id, d.subject, d.description, d.priority, d.status, d.category,
    d.admin_notes, d.resolved_at, COALESCE(d.created_at, now()), COALESCE(d.updated_at, now()), d.ticket_number, d.assigned_to, d.assigned_at
  FROM desired d
  ON CONFLICT (id) DO UPDATE SET
    user_id = excluded.user_id,
    workspace_id = excluded.workspace_id,
    subject = excluded.subject,
    description = excluded.description,
    priority = excluded.priority,
    status = excluded.status,
    category = excluded.category,
    admin_notes = excluded.admin_notes,
    resolved_at = excluded.resolved_at,
    updated_at = excluded.updated_at,
    assigned_to = excluded.assigned_to,
    assigned_at = excluded.assigned_at;

  DELETE FROM public.support_tickets st
  WHERE NOT EXISTS (
    SELECT 1 FROM public.critical_row_history h
    WHERE h.table_name = 'support_tickets'
      AND h.record_id = st.id::text
      AND h.created_at <= p_timestamp
  );

  RETURN jsonb_build_object('restored', true, 'to_upsert', v_to_upsert, 'deleted', v_to_delete);
END;
$$;

-- 5) support_ticket_replies restore helper
CREATE OR REPLACE FUNCTION public.restore_support_ticket_replies_to_timestamp(p_timestamp timestamptz, p_dry_run boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_to_upsert bigint;
  v_to_delete bigint;
BEGIN
  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'id')::uuid AS id,
      (h.row_data->>'ticket_id')::uuid AS ticket_id,
      (h.row_data->>'author_id')::uuid AS author_id,
      COALESCE((h.row_data->>'is_admin')::boolean, false) AS is_admin,
      h.row_data->>'body' AS body,
      (h.row_data->>'created_at')::timestamptz AS created_at
    FROM public.critical_row_history h
    WHERE h.table_name = 'support_ticket_replies'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  ),
  current_ids AS (
    SELECT str.id::text AS record_id
    FROM public.support_ticket_replies str
  ),
  desired_ids AS (
    SELECT d.id::text AS record_id FROM desired d
  )
  SELECT
    (SELECT count(*) FROM desired) AS to_upsert,
    (SELECT count(*) FROM current_ids ci LEFT JOIN desired_ids di ON di.record_id = ci.record_id WHERE di.record_id IS NULL) AS to_delete
  INTO v_to_upsert, v_to_delete;

  IF p_dry_run THEN
    RETURN jsonb_build_object('to_upsert', v_to_upsert, 'to_delete', v_to_delete);
  END IF;

  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'id')::uuid AS id,
      (h.row_data->>'ticket_id')::uuid AS ticket_id,
      (h.row_data->>'author_id')::uuid AS author_id,
      COALESCE((h.row_data->>'is_admin')::boolean, false) AS is_admin,
      h.row_data->>'body' AS body,
      (h.row_data->>'created_at')::timestamptz AS created_at
    FROM public.critical_row_history h
    WHERE h.table_name = 'support_ticket_replies'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  )
  INSERT INTO public.support_ticket_replies (
    id, ticket_id, author_id, is_admin, body, created_at
  )
  SELECT
    d.id, d.ticket_id, d.author_id, d.is_admin, d.body, COALESCE(d.created_at, now())
  FROM desired d
  ON CONFLICT (id) DO UPDATE SET
    ticket_id = excluded.ticket_id,
    author_id = excluded.author_id,
    is_admin = excluded.is_admin,
    body = excluded.body;

  DELETE FROM public.support_ticket_replies str
  WHERE NOT EXISTS (
    SELECT 1 FROM public.critical_row_history h
    WHERE h.table_name = 'support_ticket_replies'
      AND h.record_id = str.id::text
      AND h.created_at <= p_timestamp
  );

  RETURN jsonb_build_object('restored', true, 'to_upsert', v_to_upsert, 'deleted', v_to_delete);
END;
$$;

-- 6) support_staff_rbac restore helper
CREATE OR REPLACE FUNCTION public.restore_support_staff_rbac_to_timestamp(p_timestamp timestamptz, p_dry_run boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_to_upsert bigint;
  v_to_delete bigint;
BEGIN
  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'user_id')::uuid AS user_id,
      COALESCE(h.row_data->>'tier', 'L1') AS tier,
      COALESCE((h.row_data->>'flags')::jsonb, '{}'::jsonb) AS flags,
      (h.row_data->>'created_at')::timestamptz AS created_at,
      (h.row_data->>'updated_at')::timestamptz AS updated_at
    FROM public.critical_row_history h
    WHERE h.table_name = 'support_staff_rbac'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  ),
  current_ids AS (
    SELECT ssr.user_id::text AS record_id
    FROM public.support_staff_rbac ssr
  ),
  desired_ids AS (
    SELECT d.user_id::text AS record_id FROM desired d
  )
  SELECT
    (SELECT count(*) FROM desired) AS to_upsert,
    (SELECT count(*) FROM current_ids ci LEFT JOIN desired_ids di ON di.record_id = ci.record_id WHERE di.record_id IS NULL) AS to_delete
  INTO v_to_upsert, v_to_delete;

  IF p_dry_run THEN
    RETURN jsonb_build_object('to_upsert', v_to_upsert, 'to_delete', v_to_delete);
  END IF;

  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'user_id')::uuid AS user_id,
      COALESCE(h.row_data->>'tier', 'L1') AS tier,
      COALESCE((h.row_data->>'flags')::jsonb, '{}'::jsonb) AS flags,
      (h.row_data->>'created_at')::timestamptz AS created_at,
      (h.row_data->>'updated_at')::timestamptz AS updated_at
    FROM public.critical_row_history h
    WHERE h.table_name = 'support_staff_rbac'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  )
  INSERT INTO public.support_staff_rbac (
    user_id, tier, flags, created_at, updated_at
  )
  SELECT
    d.user_id, d.tier, d.flags, COALESCE(d.created_at, now()), COALESCE(d.updated_at, now())
  FROM desired d
  ON CONFLICT (user_id) DO UPDATE SET
    tier = excluded.tier,
    flags = excluded.flags,
    updated_at = excluded.updated_at;

  DELETE FROM public.support_staff_rbac ssr
  WHERE NOT EXISTS (
    SELECT 1 FROM public.critical_row_history h
    WHERE h.table_name = 'support_staff_rbac'
      AND h.record_id = ssr.user_id::text
      AND h.created_at <= p_timestamp
  );

  RETURN jsonb_build_object('restored', true, 'to_upsert', v_to_upsert, 'deleted', v_to_delete);
END;
$$;

-- 7) Finalize restore_table_to_timestamp
CREATE OR REPLACE FUNCTION public.restore_table_to_timestamp(
  p_table_name text,
  p_timestamp timestamptz,
  p_confirm boolean DEFAULT false,
  p_reason text DEFAULT NULL,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_allowed boolean;
  v_result jsonb;
BEGIN
  v_actor := auth.uid();
  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_allowed := p_table_name IN (
    'profiles',
    'workspaces',
    'workspace_members',
    'user_roles',
    'subscriptions',
    'paddle_subscriptions',
    'usage_limits',
    'credit_transactions',
    'support_tickets',
    'support_ticket_replies',
    'support_staff_rbac'
  );

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'table_not_allowed' USING ERRCODE = 'P0001';
  END IF;

  IF NOT p_dry_run THEN
    IF NOT p_confirm THEN
      RAISE EXCEPTION 'confirmation_required' USING ERRCODE = 'P0001';
    END IF;
    IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
      RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  CASE p_table_name
    WHEN 'profiles' THEN SELECT public.restore_profiles_to_timestamp(p_timestamp, p_dry_run) INTO v_result;
    WHEN 'workspaces' THEN SELECT public.restore_workspaces_to_timestamp(p_timestamp, p_dry_run) INTO v_result;
    WHEN 'workspace_members' THEN SELECT public.restore_workspace_members_to_timestamp(p_timestamp, p_dry_run) INTO v_result;
    WHEN 'user_roles' THEN SELECT public.restore_user_roles_to_timestamp(p_timestamp, p_dry_run) INTO v_result;
    WHEN 'subscriptions' THEN SELECT public.restore_subscriptions_to_timestamp(p_timestamp, p_dry_run) INTO v_result;
    WHEN 'paddle_subscriptions' THEN SELECT public.restore_paddle_subscriptions_to_timestamp(p_timestamp, p_dry_run) INTO v_result;
    WHEN 'usage_limits' THEN SELECT public.restore_usage_limits_to_timestamp(p_timestamp, p_dry_run) INTO v_result;
    WHEN 'credit_transactions' THEN SELECT public.restore_credit_transactions_to_timestamp(p_timestamp, p_dry_run) INTO v_result;
    WHEN 'support_tickets' THEN SELECT public.restore_support_tickets_to_timestamp(p_timestamp, p_dry_run) INTO v_result;
    WHEN 'support_ticket_replies' THEN SELECT public.restore_support_ticket_replies_to_timestamp(p_timestamp, p_dry_run) INTO v_result;
    WHEN 'support_staff_rbac' THEN SELECT public.restore_support_staff_rbac_to_timestamp(p_timestamp, p_dry_run) INTO v_result;
    ELSE
      RAISE EXCEPTION 'restore_not_implemented_for_table' USING ERRCODE = 'P0001';
  END CASE;

  -- Audit the rollback request in BOTH audit systems.
  PERFORM public.append_system_audit_log(
    v_actor,
    NULL,
    NULL,
    CASE WHEN p_dry_run THEN 'admin:rollback:dry_run' ELSE 'admin:rollback:execute' END,
    'restore_table_to_timestamp executed for ' || p_table_name,
    NULL,
    NULL,
    jsonb_build_object('table', p_table_name, 'timestamp', p_timestamp, 'reason', p_reason, 'result', v_result)
  );

  PERFORM public.write_audit_log(
    p_actor_id      := v_actor,
    p_actor_email   := NULL,
    p_actor_role    := 'super_admin',
    p_action        := CASE WHEN p_dry_run THEN 'ROLLBACK_DRY_RUN' ELSE 'ROLLBACK_EXECUTE' END,
    p_resource_type := 'table',
    p_resource_id   := p_table_name,
    p_old_value     := NULL,
    p_new_value     := jsonb_build_object('timestamp', p_timestamp, 'result', v_result, 'reason', p_reason),
    p_metadata      := jsonb_build_object('mechanism', 'critical_row_history')
  );

  RETURN jsonb_build_object(
    'table', p_table_name,
    'timestamp', p_timestamp,
    'dry_run', p_dry_run,
    'result', v_result
  );
END;
$$;

COMMIT;
