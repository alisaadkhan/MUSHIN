-- Add restore_email_credit RPC
-- Called by send-outreach-email edge function when Resend API fails
-- after a credit has already been deducted (SEC-04 fix: deduct-then-send-then-refund).

CREATE OR REPLACE FUNCTION restore_email_credit(ws_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE workspaces
  SET email_sends_remaining = email_sends_remaining + 1
  WHERE id = ws_id;
END;
$$;

-- Grant execute only to authenticated users (edge functions run as the calling user)
GRANT EXECUTE ON FUNCTION restore_email_credit(uuid) TO authenticated;
