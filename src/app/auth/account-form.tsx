"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft, BookOpenText, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "reset";
export function AccountForm({ enabled }:{ enabled: boolean }) {
  const router = useRouter();
  const query = useSearchParams();
  const [mode,setMode] = useState<Mode>("signin");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [visible,setVisible] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const linkError=query.get("error");
  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    if(!enabled || busy)return;
    setBusy(true);setError("");setMessage("");
    try{
      const client=createClient();
      if(mode==="signin"){
        const {error:authError}=await client.auth.signInWithPassword({email:email.trim(),password});
        if(authError)throw authError;
        router.push("/");router.refresh();
      }else if(mode==="signup"){
        if(password.length<12)throw Error("Use at least 12 characters for your password.");
        const {error:authError}=await client.auth.signUp({
          email:email.trim(),password,
          options:{emailRedirectTo:window.location.origin+"/auth/callback"}
        });
        if(authError)throw authError;
        setMessage("If the address can be registered, check your inbox to verify it. Then sign in.");
      }else{
        const {error:authError}=await client.auth.resetPasswordForEmail(email.trim(),{
          redirectTo:window.location.origin+"/auth/callback?next=/auth/update-password"
        });
        if(authError)throw authError;
        setMessage("If the address has an account, a recovery email will be sent.");
      }
    }catch(e){
      setError(e instanceof Error?e.message:"Authentication is temporarily unavailable.");
    }finally{setBusy(false);}
  };
  const resend = async()=>{
    if(!enabled||!email.trim()||busy)return;
    setBusy(true);setError("");setMessage("");
    try{
      const {error:resendError}=await createClient().auth.resend({
        type:"signup",email:email.trim(),
        options:{emailRedirectTo:window.location.origin+"/auth/callback"}
      });
      if(resendError)throw resendError;
      setMessage("If this address has an unverified account, a new confirmation email will be sent.");
    }catch(e){setError(e instanceof Error?e.message:"Confirmation message could not be sent.");}
    finally{setBusy(false);}
  };
  return <main className="auth-shell">
    <div className="auth-brand"><span className="brand-symbol"><BookOpenText size={24}/></span><span>Mezgeb <small>መዝገብ</small></span></div>
    <section className="auth-panel">
      <Link className="auth-back" href="/"><ArrowLeft size={17}/> Back to Mezgeb</Link>
      <div className="auth-icon"><LockKeyhole size={24}/></div>
      <span className="eyebrow">ACCOUNT ACCESS</span>
      <h1>{mode==="signin"?"Welcome back":mode==="signup"?"Create your account":"Reset your password"}</h1>
      <p>{mode==="signin"?"Sign in securely with your Mezgeb account.":mode==="signup"?"Start with one secure identity for your business.":"We'll email you a recovery link."}</p>
      {!enabled&&<div className="notice" role="status"><ShieldCheck size={19}/> Secure account sign-in is waiting for the dedicated Mezgeb Supabase project. Your existing ledger remains local and accessible.</div>}
      {linkError&&<p className="form-error" role="alert">That confirmation link could not be verified. Request another link.</p>}
      <form onSubmit={submit} className="auth-form">
        <label>Email address<input type="email" autoComplete="email" required disabled={!enabled||busy} maxLength={250} placeholder="you@business.com" value={email} onChange={e=>setEmail(e.target.value)}/></label>
        {mode!=="reset"&&<label>Password<div className="password-input"><input type={visible?"text":"password"} autoComplete={mode==="signup"?"new-password":"current-password"} minLength={mode==="signup"?12:1} required disabled={!enabled||busy} value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" aria-label={visible?"Hide password":"Show password"} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}
        {error&&<p className="form-error" role="alert">{error}</p>}
        {message&&<p className="notice" role="status">{message}</p>}
        <button className="btn primary full" disabled={!enabled||busy} type="submit">{busy?"Please wait…":mode==="signin"?"Sign in":mode==="signup"?"Create account":"Email recovery link"}</button>
      </form>
      {mode!=="reset"&&<button className="btn subtle full" type="button" disabled={!enabled||busy||!email.trim()} onClick={()=>void resend()}>Resend verification email</button>}
      <div className="auth-switch">
        {mode==="signin"?<><button onClick={()=>{setMode("reset");setError("");}}>Forgot password?</button><button onClick={()=>{setMode("signup");setError("");}}>Create account</button></>:
        <button onClick={()=>{setMode("signin");setError("");setMessage("");}}>Back to sign in</button>}
      </div>
      <p className="auth-scope"><ShieldCheck size={15}/> Account email confirmation is required for cloud sync. Your device remains offline-first, and the first cloud pairing requires your approval.</p>
    </section>
    <footer className="auth-footer"><Mail size={14}/> Mezgeb by Hisab Technologies · Financial records remain on this device.</footer>
  </main>;
}
