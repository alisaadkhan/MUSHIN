-- Support billing visibility (restricted, read-only)
-- - Shows subscription status + invoices for a user's owned workspace(s)
-- - Requires support permission: canViewBilling
-- - Does NOT expose payment method details

CREATE OR REPLACE FUNCTION public.support_get_user_billing_summary(p_user_id uuid, p_limit_invoices int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can boolean;
  v_ws_ids uuid[];
  v_result jsonb;
BEGIN
  v_can := public.support_has_permission('canViewBilling');
  IF NOT v_can THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT array_agg(w.id) INTO v_ws_ids
  FROM public.workspaces w
  WHERE w.owner_id = p_user_id;

  v_result := jsonb_build_object(
    'workspaces', COALESCE((
      SELECT jsonb_agg(to_jsonb(w) - 'stripe_customer_id' - 'stripe_subscription_id')
      FROM (
        SELECT id, name, plan, owner_id, created_at
        FROM public.workspaces
        WHERE id = ANY(COALESCE(v_ws_ids, ARRAY[]::uuid[]))
        ORDER BY created_at DESC
        LIMIT 5
      ) w
    ), '[]'::jsonb),
    'subscriptions', COALESCE((
      SELECT jsonb_agg(to_jsonb(s))
      FROM (
        SELECT workspace_id, plan, status, current_period_start, current_period_end, cancel_at_period_end, updated_at
        FROM public.subscriptions
        WHERE workspace_id = ANY(COALESCE(v_ws_ids, ARRAY[]::uuid[]))
        ORDER BY updated_at DESC
      ) s
    ), '[]'::jsonb),
    'paddle_subscriptions', COALESCE((
      SELECT jsonb_agg(to_jsonb(ps) - 'raw' - 'metadata')
      FROM (
        SELECT workspace_id, status, plan, current_period_end, cancel_at_period_end, updated_at, created_at
        FROM public.paddle_subscriptions
        WHERE workspace_id = ANY(COALESCE(v_ws_ids, ARRAY[]::uuid[]))
        ORDER BY updated_at DESC
      ) ps
    ), '[]'::jsonb),
    'invoices', COALESCE((
      SELECT jsonb_agg(to_jsonb(i))
      FROM (
        SELECT workspace_id, amount_paid, currency, status, invoice_pdf, created_at
        FROM public.invoices
        WHERE workspace_id = ANY(COALESCE(v_ws_ids, ARRAY[]::uuid[]))
        ORDER BY created_at DESC
        LIMIT LEAST(GREATEST(COALESCE(p_limit_invoices, 20), 1), 100)
      ) i
    ), '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.support_get_user_billing_summary FROM anon;
GRANT EXECUTE ON FUNCTION public.support_get_user_billing_summary TO authenticated;

