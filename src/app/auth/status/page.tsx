import Link from "next/link";
import { BookOpenText, CheckCircle2, ShieldCheck, AlertTriangle, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

/**
 * Live account-status check against Supabase Auth, not a client-supplied JWT.
 * The result is never cached; refreshing this page checks cookie persistence.
 */
export default async function AuthStatusPage() {
 const enabled=isSupabaseConfigured();
 const client=enabled?await createClient():null;
 const result=client?await client.auth.getUser():null;
 const user=result?.error?null:result?.data.user;
 const verified=Boolean(user?.email_confirmed_at);
 return <main className="auth-shell">
  <div className="auth-brand"><span className="brand-symbol"><BookOpenText/></span>Mezgeb <small>መዝገብ</small></div>
  <section className="auth-panel">
   <div className="auth-icon">{verified?<CheckCircle2/>:user?<AlertTriangle/>:<ShieldCheck/>}</div>
   <span className="eyebrow">SECURE ACCOUNT STATUS</span>
   <h1>{!enabled?"Cloud connection unavailable":verified?"Your email is confirmed":user?"Email confirmation required":"Sign in to Mezgeb"}</h1>
   <p>{!enabled?"Mezgeb cannot connect to its dedicated Supabase project on this deployment."
    :verified?"Supabase verified your identity on the server using the current session cookies."
    :user?"You have a session, but this email has not been confirmed. Cloud sync is disabled."
    :"No valid server session was found. Your local ledger remains available."}</p>
   {verified&&<p className="notice" role="status"><ShieldCheck size={17}/> Verified account session active</p>}
   <div className="cloud-buttons">
    <a href="/auth/status" className="btn subtle"><RefreshCw size={16}/> Recheck server session</a>
    {verified?<Link href="/settings" className="btn primary">Continue to Mezgeb</Link>
      :<Link href="/auth" className="btn primary">{user?"Sign in again / resend":"Go to sign in"}</Link>}
   </div>
   <p className="muted">To test session persistence, reload this page or close and reopen your browser. A server verification should still succeed until you sign out or your session expires.</p>
   <p className="muted">For account safety this page does not display access tokens or private financial records.</p>
  </section>
 </main>;
}
