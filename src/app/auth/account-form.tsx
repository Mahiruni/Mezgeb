"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, BookOpenText, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import {useLedger} from "@/app/providers";
import {tr,words} from "@/lib/signature-copy";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "reset";
export function AccountForm({ enabled }:{ enabled: boolean }) {
  const router = useRouter();
  const query = useSearchParams();
  const {doc,update}=useLedger();
  const t=(p:Parameters<typeof tr>[1])=>tr(doc.locale,p);
  const [mode,setMode] = useState<Mode>(query.get("mode")==="signup"?"signup":"signin");
  const [name,setName]=useState("");
  const [agreed,setAgreed]=useState(false);
  useEffect(()=>{try{window.localStorage.setItem("mezgeb_intro_seen","1");}catch{}},[]);
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
        const {data,error:authError}=await client.auth.signInWithPassword({email:email.trim().toLowerCase().toLowerCase(),password});
        if(authError)throw authError;
        // A session is not proof of email confirmation if the Auth project
        // is misconfigured; don't allow the UI to imply a verified identity.
        if(!data.user?.email_confirmed_at){
          await client.auth.signOut();
          setError("Confirm your email before signing in. Use Resend verification email if needed.");
          return;
        }
        router.replace("/");router.refresh();
      }else if(mode==="signup"){
        if(password.length<12)throw Error("Use at least 12 characters for your password.");
        if(!name.trim()||!agreed)throw Error("Enter your name and accept the privacy notice.");
        const {data,error:authError}=await client.auth.signUp({
          email:email.trim().toLowerCase(),password,
          options:{emailRedirectTo:window.location.origin+"/auth/callback",data:{full_name:name.trim()}}
        });
        if(authError)throw authError;
        // Supabase returns a session immediately when Confirm Email is off.
        // Fail closed: new accounts must not start verified financial sync
        // from a project where sign-up confirmation has been disabled.
        if(data.session){
          await client.auth.signOut();
          setError("Email confirmation is disabled in the Mezgeb Auth project. For account security, an administrator must enable Confirm Email before registrations can be used.");
          return;
        }
        setPassword("");
        setMessage("If this address can be registered, open the verification link sent to your inbox. Use the same browser to complete the link, then sign in.");
      }else{
        const {error:authError}=await client.auth.resetPasswordForEmail(email.trim(),{
          redirectTo:window.location.origin+"/auth/callback?next=/auth/update-password"
        });
        if(authError)throw authError;
        setMessage("If this address has an account, follow the recovery email on the same device and browser where you requested it.");
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
        type:"signup",email:email.trim().toLowerCase(),
        options:{emailRedirectTo:window.location.origin+"/auth/callback"}
      });
      if(resendError)throw resendError;
      setMessage("If this address has an unverified account, a new confirmation email will be sent.");
    }catch(e){setError(e instanceof Error?e.message:"Confirmation message could not be sent.");}
    finally{setBusy(false);}
  };
  return <main className="auth-shell signature-auth">
    <aside className="auth-visual" aria-hidden="true"><div className="auth-visual-mark">መ</div><div className="auth-visual-copy"><span className="eyebrow light">YOUR BUSINESS, BEAUTIFULLY ORGANIZED</span><h2>Clarity for every birr.</h2><p>Sales, expenses, Dube, and receipts in one considered workspace.</p><div className="auth-visual-foot"><ShieldCheck size={17}/> Offline-first. Secure by design.</div></div></aside>
    <div className="auth-brand"><span className="brand-symbol"><BookOpenText size={24}/></span><span>Mezgeb <small>መዝገብ</small></span><select className="auth-language" aria-label={t(words.language)} value={doc.locale==="am"||doc.locale==="om"?doc.locale:"en"} onChange={e=>update(d=>({...d,locale:e.target.value as "en"|"am"|"om"}))}><option value="en">English</option><option value="am">አማርኛ</option><option value="om">Afaan Oromoo</option></select></div>
    <section className="auth-panel">
      <Link className="auth-back" href="/"><ArrowLeft size={17}/> Back to Mezgeb</Link>
      <div className="auth-icon"><LockKeyhole size={24}/></div>
      <span className="eyebrow">ACCOUNT ACCESS</span>
      <h1>{mode==="signin"?t(words.welcome):mode==="signup"?t(words.create):t(words.recover)}</h1>
      <p>{mode==="signin"?"Sign in securely with your Mezgeb account.":mode==="signup"?"Start with one secure identity for your business.":"We'll email you a recovery link."}</p>
      {!enabled&&<div className="notice" role="status"><ShieldCheck size={19}/> Secure account sign-in is waiting for the dedicated Mezgeb Supabase project. Your existing ledger remains local and accessible.</div>}
      {linkError&&<p className="form-error" role="alert">That confirmation link could not be verified. Request another link.</p>}
      {query.get("password")==="updated"&&<p className="notice" role="status">Your password was updated. Sign in using the new password.</p>}
      <form onSubmit={submit} className="auth-form">
        {mode==="signup"&&<label>{t(words.name)}<input autoComplete="name" required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder={t(words.name)}/></label>}
        <label>{t(words.email)}<input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="email" required disabled={!enabled||busy} maxLength={250} placeholder="you@business.com" value={email} onChange={e=>setEmail(e.target.value)}/></label>
        {mode!=="reset"&&<label>{t(words.password)}<div className="password-input"><input type={visible?"text":"password"} autoComplete={mode==="signup"?"new-password":"current-password"} minLength={mode==="signup"?12:1} required disabled={!enabled||busy} value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" aria-label={visible?"Hide password":"Show password"} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}
        {mode==="signup"&&<><p className="muted">{t(["Use at least 12 characters.","ቢያንስ 12 ፊደላት ይጠቀሙ።","Arfii 12 yoo xiqqaate fayyadami."])}</p><label className="check-row"><input type="checkbox" required checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><span>{t(words.agree)} <Link href="/privacy">{t(words.privacy)}</Link></span></label></>}
        {error&&<p className="form-error" role="alert">{error}</p>}
        {message&&<p className="notice" role="status">{message}</p>}
        <button className="btn primary full" disabled={!enabled||busy} type="submit">{busy?t(words.wait):mode==="signin"?t(words.signin):mode==="signup"?t(words.start):"Email recovery link"}</button>
      </form>
      {mode!=="reset"&&<button className="btn subtle full" type="button" disabled={!enabled||busy||!email.trim()} onClick={()=>void resend()}>Resend verification email</button>}
      <div className="auth-switch">
        {mode==="signin"?<><button onClick={()=>{setMode("reset");setError("");}}>Forgot password?</button><button onClick={()=>{setMode("signup");setError("");}}>Create account</button></>:
        <button onClick={()=>{setMode("signin");setError("");setMessage("");}}>Back to sign in</button>}
      </div>
      <p className="auth-scope"><ShieldCheck size={15}/> Account email confirmation is required for cloud sync. Your device remains offline-first, and the first cloud pairing requires your approval.</p>
      <Link className="btn subtle full" href="/auth/status">Check my verified account session</Link>
    </section>
    <footer className="auth-footer"><Mail size={14}/> Mezgeb by Hisab Technologies · Financial records remain on this device.</footer>
  </main>;
}
