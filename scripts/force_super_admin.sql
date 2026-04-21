-- FORCE SUPER ADMIN PROMOTION -- 
-- Execute this snippet in the Supabase Studio SQL Editor to ensure your account retains Superadmin status.

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'
FROM auth.users
WHERE email = 'alisaad75878@gmail.com'
ON CONFLICT (user_id) 
DO UPDATE SET role = EXCLUDED.role;
