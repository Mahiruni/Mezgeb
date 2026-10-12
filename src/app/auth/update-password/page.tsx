"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BookOpenText, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function UpdatePasswordPage() {
 const router=useRouter();
 const [password,setPassword]=useState("");
 const [confirm,setConfirm]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const submit=async(e:FormEvent)=>{
   e.preventDefault();setError("");
   if(password.length<12||password!==confirm){setError("Use a matching password with at least 12 characters.");return;}
   setBusy(true);
   try {
     const client=createClient();
     const {data:{user},error:identityError}=await client.auth.getUser();
     if(identityError||!user)throw Error("Your recovery session expired. Request a new recovery email.");
     const {error:changeError}=await client.auth.updateUser({password});
     if(changeError)throw changeError;
     // End the password-recovery session so its purpose is limited to
     // recovery. The user must explicitly authenticate with the new password.
     const {error:signOutError}=await client.auth.signOut();
     if(signOutError)throw Error("Password changed, but session cleanup failed. Sign out before continuing.");
     setPassword("");setConfirm("");
     router.replace("/auth?password=updated");router.refresh();
   }catch(e){setError(e instanceof Error?e.message:"Password update failed.");}
   finally{setBusy(false);}
 };
 return <main className="auth-shell"><div className="auth-brand"><span className="brand-symbol"><BookOpenText/></span>Mezgeb <small>መዝገብ</small></div><section className="auth-panel">
  <div className="auth-icon"><ShieldCheck/></div><h1>Set your new password</h1><p>Choose a secure password for your Mezgeb account.</p>
  {!isSupabaseConfigured()?<p className="notice">Supabase has not been connected.</p>:<form className="auth-form" onSubmit={submit}>
   <label>New password<input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <label>Confirm password<input type="password" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <button className="btn primary full" type="submit" disabled={busy}>{busy?"Updating…":"Update password"}</button>
  </form>}
  <Link className="auth-back" href="/auth">Return to sign in</Link>
 </section></main>;
}
