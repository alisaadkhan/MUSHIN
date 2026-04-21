import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { MushInLogo } from '@/components/ui/MushInLogo';

/* Shared input — same pattern as Auth.tsx, no blur, no effects */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  right?: React.ReactNode;
}
const AdminInput = ({ icon, right, ...props }: InputProps) => (
  <div className="relative">
    {icon && (
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none">
        {icon}
      </span>
    )}
    <input
      className={`auth-input ${icon ? 'pl-9' : ''} ${right ? 'pr-9' : ''}`}
      {...props}
    />
    {right && (
      <span className="absolute right-3 top-1/2 -translate-y-1/2">{right}</span>
    )}
  </div>
);

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication failed.');

      /* Server-side role check — only super_admin or admin may enter */
      const { data: role, error: roleErr } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['super_admin', 'admin'])
        .is('revoked_at', null)
        .maybeSingle();

      if (roleErr || !role) {
        await supabase.auth.signOut();
        throw new Error('This account does not have admin access.');
      }

      navigate('/admin');
    } catch (err: any) {
      toast({
        title: 'Access denied',
        description: err?.message ?? 'Invalid credentials.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden theme-auth">

      {/* Background — single static gradient, no animated blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 800px 500px at 50% -80px, rgba(239,68,68,0.18) 0%, rgba(139,92,246,0.08) 50%, transparent 75%)',
        }}
      />

      {/* Restricted access indicator */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-red-500/20 bg-red-500/5">
          <ShieldAlert size={12} className="text-red-400" />
          <span className="text-[11px] text-red-300/70 font-medium tracking-wide">
            Restricted Access — Admins Only
          </span>
        </div>
      </div>

      {/* Card */}
      <div className="auth-card">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <MushInLogo height={28} />
        </div>

        {/* Icon + heading */}
        <div className="mb-7 text-center">
          <div className="w-11 h-11 rounded-full border border-red-500/20 bg-red-500/8 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={18} className="text-red-400" />
          </div>
          <h1 className="text-lg font-semibold text-white tracking-tight">Admin Portal</h1>
          <p className="text-sm text-white/35 mt-1">Use your admin credentials to continue</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <AdminInput
            type="email"
            placeholder="Admin email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            icon={<Mail size={14} />}
          />

          <AdminInput
            type={showPw ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            icon={<Lock size={14} />}
            right={
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="text-white/25 hover:text-white/50 transition-colors"
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            }
          />

          {/* Submit — red accent to differentiate from user auth */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg font-semibold text-sm text-white mt-2
                       bg-red-600/80 hover:bg-red-600 transition-colors duration-150
                       flex items-center justify-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? <Loader2 size={15} className="animate-spin" />
              : 'Access Admin Panel'
            }
          </button>
        </form>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link
            to="/auth"
            className="text-[12px] text-white/25 hover:text-white/50 transition-colors"
          >
            ← Back to main login
          </Link>
        </div>
      </div>
    </div>
  );
}
