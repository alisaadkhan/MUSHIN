-- Admin Control: Restrict User RPC
CREATE OR REPLACE FUNCTION public.restrict_user(target_user_id UUID, restrict_reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if the caller is a system admin
    IF NOT public.is_system_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized: Only system administrators can restrict users';
    END IF;

    -- Update the profile
    UPDATE public.profiles
    SET 
        is_restricted = TRUE,
        is_suspicious = TRUE
    WHERE id = target_user_id;

    -- Log the admin action
    INSERT INTO public.admin_audit_log (admin_user_id, action, target_user_id, details)
    VALUES (auth.uid(), 'restrict_user', target_user_id, json_build_object('reason', restrict_reason));
END;
$$;
