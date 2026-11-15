import React,{Component,useEffect,useState,type ReactNode} from "react";
import {createRoot} from "react-dom/client";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/noto-sans-ethiopic";
import "../app/globals.css";
import "../app/safe-areas.css";
import {LedgerProvider,useLedger} from "../app/providers";
import {SyncProvider} from "../app/sync-provider";
import {Workspace} from "../app/workspace";
import {AccountForm} from "../app/auth/account-form";
import UpdatePasswordPage from "../app/auth/update-password/page";
import Privacy from "../app/privacy/page";
import {isSupabaseConfigured} from "../lib/supabase/config";
import {createClient} from "../lib/supabase/client";
import {installNativeLinks,usePathname,navigate,PREFIX} from "./navigation";
import Link from "./link";
const configured=isSupabaseConfigured();
function NativeAuthStatus(){const [status,setStatus]=useState("Checking verified account…");const [verified,setVerified]=useState(false);useEffect(()=>{if(!configured){setStatus("Online account settings are available in the existing web interface.");return;}let live=true;createClient().auth.getUser().then(({data,error})=>{if(!live)return;const ok=!error&&Boolean(data.user?.email_confirmed_at);setVerified(ok);setStatus(ok?"Your email is confirmed.":"Sign in or confirm your email to continue.");}).catch(()=>{if(live)setStatus("Account verification is unavailable while offline.");});return()=>{live=false;};},[]);return <main className="auth-shell signature-auth"><section className="auth-panel"><h1>Mezgeb account</h1><p role="status">{status}</p><Link className="btn primary full" href={verified?"/":"/auth"}>{verified?"Continue to Mezgeb":"Sign in"}</Link><a className="btn subtle full" href="/auth/status?nativeOnline=1">Open online account status</a></section></main>;}
function NativeApp(){const path=usePathname();const {ready,error}=useLedger();const [online,setOnline]=useState(navigator.onLine);useEffect(()=>{const change=()=>setOnline(navigator.onLine);window.addEventListener("online",change);window.addEventListener("offline",change);return()=>{window.removeEventListener("online",change);window.removeEventListener("offline",change);};},[]);useEffect(()=>{if(ready)document.title="Mezgeb Ready";else if(error)document.title="Mezgeb Recovery";},[ready,error]);if(!ready&&error)return <StartupRecovery/>;if(!ready)return <div className="loading-shell"><span className="brand-symbol">መ</span><h1>Mezgeb</h1><p>Opening your ledger…</p></div>;if(path==="/auth")return <><AccountForm enabled={configured}/>{!configured&&<div className="native-online-fallback"><a className="btn primary" href="/auth?nativeOnline=1">Open existing online account</a><Link className="btn subtle" href="/">Continue on this device</Link></div>}</>;if(path==="/auth/status")return <NativeAuthStatus/>;if(path==="/auth/update-password")return <UpdatePasswordPage/>;if(path==="/privacy")return <Privacy/>;return <><Workspace section={path==="/"?"home":path.slice(1)}/>{!configured&&path==="/settings"&&<aside className="native-online-fallback"><p>Cloud access remains available in the existing online app. The bundled ledger keeps working on this device.</p><a className="btn subtle" href="/settings?nativeOnline=1">Open online account & cloud</a></aside>}</>;}
function StartupRecovery(){return <main className="auth-shell"><section className="auth-panel"><span className="brand-symbol">መ</span><h1>Mezgeb could not open</h1><p>Your existing records have not been cleared. Retry or open the existing online interface.</p><button className="btn primary full" onClick={()=>location.reload()}>Retry</button><a className="btn subtle full" href="/?nativeOnline=1">Open existing online interface</a></section></main>;}
class StartupBoundary extends Component<{children:ReactNode},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){document.title="Mezgeb Recovery";}
 render(){return this.state.failed?<StartupRecovery/>:this.props.children;}
}
installNativeLinks();
const root=document.getElementById("root");
if(root)createRoot(root).render(<StartupBoundary><LedgerProvider><SyncProvider><NativeApp/></SyncProvider></LedgerProvider></StartupBoundary>);
