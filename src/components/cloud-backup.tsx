"use client";
import { useState } from "react";
import Link from "next/link";
import { Cloud, CloudOff, CloudUpload, CloudDownload, RefreshCw, ShieldCheck, LogOut, AlertTriangle, WifiOff, History, Link2Off, CheckCircle2 } from "lucide-react";
import { useLedger } from "@/app/providers";
import { useSync } from "@/app/sync-provider";
import { type Document } from "@/lib/mezgeb";

function saveCopy(doc:Document,label:string){
  const blob=new Blob([JSON.stringify(doc,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="mezgeb-"+label+"-"+new Date().toISOString().slice(0,10)+".json";a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const statuses={
 "unconfigured":"Set up Supabase to enable cloud sync",
 "checking":"Verifying your account and backup",
 "signed-out":"Sign in to link this device",
 "unverified":"Confirm your email before syncing",
 "not-linked":"Choose how to link this device",
 "account-switch":"This device is linked to another account",
 "offline":"Offline — changes stay on this device",
 "syncing":"Synchronizing records securely",
 "synced":"Up to date across connected devices",
 "conflict":"Conflict detected — review required",
 "error":"Connection error — changes stay local"
} as const;
export function CloudBackup(){
 const {doc}=useLedger();
 const sync=useSync();
 const [busy,setBusy]=useState(false);
 const [restoreShow,setRestoreShow]=useState(false);
 const [notice,setNotice]=useState("");
 // Discovery is handled by SyncProvider auto-pair to avoid racing first-time local checkpoints.
 const askConnect=async(choice:"device"|"cloud")=>{
  if(!sync.accountId||busy)return;
  if(choice==="cloud"&&!sync.cloud){setNotice("No cloud copy to restore. Upload this device instead.");return;}
  let confirmText=choice==="cloud"
   ?"Replace the local ledger on this device with the latest cloud snapshot? A recoverable safety copy of local data will be created first. This does not delete the cloud copy."
   :sync.cloud
    ?"REPLACE the existing cloud ledger with this device's records? The cloud ledger may have changes not present here. A recovery copy will be saved, but other devices may need manual conflict resolution."
    :"Begin automatic secure backup and sync for this account? This device's current financial records will be uploaded.";
  if(!window.confirm(confirmText))return;
  if(sync.cloud&&choice==="device"&&!window.confirm("Confirm replacing an existing CLOUD financial ledger. Any entries missing from this device will no longer appear in the live cloud snapshot. Continue?"))return;
  setBusy(true);setNotice("");
  try{await sync.connect(choice);}finally{setBusy(false);}
 };
 const resolve=async(choice:"device"|"cloud")=>{
  if(!sync.cloud)return;
  saveCopy(doc,"local-conflict");
  saveCopy(sync.cloud.document,"cloud-conflict");
  const text=choice==="cloud"?"Keep the CLOUD version? This device's unsynced edits will be replaced; both copies are exported and a recovery history entry is created.":
   "Keep this DEVICE's version? This overwrites the conflicting cloud data, after an extra server revision check. Both versions are exported.";
  if(!window.confirm(text))return;
  if(choice==="device"&&!window.confirm("Confirm overwriting the conflicting CLOUD version with this device's financial records."))return;
  setBusy(true);try{await sync.resolve(choice);}finally{setBusy(false);}
 };
 const unlink=async()=>{
  if(!window.confirm("Unlink this device from the previously connected account? Data stays here and a recovery copy will be saved. Sign in with the correct account before enabling sync again."))return;
  saveCopy(doc,"before-unlink");
  setBusy(true);try{await sync.disconnect();}finally{setBusy(false);}
 };
 const recover=async(index:number)=>{
  const copy=sync.recovery[index];
  if(!copy)return;
  if(!window.confirm("Restore this earlier local recovery copy? Your current ledger is backed up before replacement. It may require conflict review before cloud upload."))return;
  saveCopy(doc,"before-recovery");
  setBusy(true);try{await sync.recover(copy);}finally{setBusy(false);}
 };
 return <section className="surface settings-section cloud-section" aria-label="Automatic Mezgeb cloud synchronization">
   <div className="surface-title"><h2>Secure cloud sync</h2><Cloud size={19}/></div>
   <p className="muted">After verified sign-in, Mezgeb connects cloud sync automatically when it is safe. New entries save on this device first; independent transactions merge, while different existing financial records require your review.</p>
   <div className={"sync-banner sync-"+sync.status} role="status">
    {sync.status==="synced"?<CheckCircle2 size={19}/>:sync.status==="offline"?<WifiOff size={19}/>:sync.status==="conflict"||sync.status==="error"?<AlertTriangle size={19}/>:<Cloud size={19}/>}
    <span>{statuses[sync.status]}</span>
   </div>
   {sync.email&&<p className="muted">Account: {sync.email}</p>}
   {sync.message&&<p className="form-error" role="status">{sync.message}</p>}
   {notice&&<p className="notice" role="status">{notice}</p>}
   {sync.status==="unconfigured"&&<p className="notice">Cloud access has not been configured for this deployment. Your ledger remains on-device only.</p>}
   {sync.status==="signed-out"&&<Link className="btn primary full" href="/auth">Sign in / create account</Link>}
   {sync.status==="unverified"&&<p className="notice">Open the verification link sent to your email, then return here. Unverified accounts cannot upload financial records.</p>}
   {sync.status==="not-linked"&&<div className="cloud-status">
    {sync.cloud&&<p className="notice">An existing cloud ledger was found ({sync.cloud.document.entries.length} entries and {sync.cloud.document.customers.length} customers). Choose carefully before pairing this device.</p>}
    {doc.business.name&&<button className="btn subtle full" disabled={busy} onClick={()=>void askConnect("device")}><CloudUpload size={17}/> {sync.cloud?"Use this device's records (manual review)":"Connect this device manually (optional)"}</button>}
    {sync.cloud&&<button className="btn subtle full" disabled={busy} onClick={()=>void askConnect("cloud")}><CloudDownload size={17}/> Use existing cloud records</button>}
    {!doc.business.name&&<p className="muted">No sync button is needed. Finish business setup and Mezgeb will upload automatically, or restore your existing cloud business when this device is empty.</p>}
   </div>}
   {sync.status==="account-switch"&&<div className="cloud-status">
    <p className="notice"><AlertTriangle size={16}/> This browser is paired to a different Mezgeb identity. Automatic uploading is blocked to prevent cross-account financial data transfer.</p>
    <button className="btn subtle" type="button" disabled={busy} onClick={()=>void unlink()}><Link2Off size={17}/> Export backup and unlink previous account</button>
   </div>}
   {sync.status==="synced"&&<div className="cloud-status">
    <div className="integration-row"><span><ShieldCheck size={17}/> Authenticated and connected</span><b>Enabled</b></div>
    <div className="integration-row"><span><Cloud size={17}/> Last successful sync</span><b>{sync.lastSyncedAt?new Date(sync.lastSyncedAt).toLocaleString():"Pending"}</b></div>
    <p className="muted">Changes synchronize automatically while connected. Offline edits remain stored locally and retry after reconnection.</p>
    <button className="btn subtle" type="button" disabled={busy} onClick={()=>void sync.refresh()}><RefreshCw size={16}/> Check now</button>
   </div>}
   {sync.status==="conflict"&&<div className="cloud-status">
    <p className="notice">Automatic uploads are paused. Two devices changed the same financial record, or a merged balance/reference needs review. Neither copy has been deleted.</p>
    <div className="sync-conflicts">{sync.conflictList.slice(0,12).map((c,i)=><p key={i}><b>{c.section}: {c.key}</b> — {c.reason}</p>)}</div>
    {sync.cloud&&<><button className="btn subtle full" onClick={()=>{saveCopy(doc,"device-conflict");saveCopy(sync.cloud!.document,"cloud-conflict");}}><CloudDownload size={17}/> Export BOTH copies before resolving</button>
      <div className="cloud-buttons">
       <button className="btn subtle" disabled={busy} onClick={()=>void resolve("cloud")}>Keep cloud version</button>
       <button className="btn primary" disabled={busy} onClick={()=>void resolve("device")}>Keep this device</button>
      </div></>}
    <button className="btn subtle" disabled={busy} onClick={()=>void sync.refresh()}><RefreshCw size={16}/> Recheck remote</button>
   </div>}
   {(sync.status==="offline"||sync.status==="error")&&<button className="btn subtle" onClick={()=>void sync.refresh()} disabled={busy}><RefreshCw size={16}/> Retry securely</button>}
   {sync.linkedAccountId&&sync.accountId===sync.linkedAccountId&&<div className="sync-recovery">
      <div className="integration-row"><span><History size={17}/> On-device recovery copies</span><button type="button" onClick={()=>setRestoreShow(x=>!x)}>{restoreShow?"Hide":"Show"} ({sync.recovery.length})</button></div>
      {restoreShow&&<div className="sync-recovery-list">{sync.recovery.slice(0,10).map((copy,index)=><div key={copy.id}><span>{new Date(copy.at).toLocaleString()}<small>{copy.reason}</small></span><button className="btn subtle" disabled={busy} onClick={()=>{saveCopy(copy.document,"recovery-"+(index+1));}}>Export</button><button className="btn subtle" disabled={busy} onClick={()=>void recover(index)}>Restore</button></div>)}</div>}
      <button className="btn ghost" type="button" disabled={busy} onClick={()=>void unlink()}><Link2Off size={16}/> Turn off sync on this device</button>
    </div>}
   {sync.accountId&&<button className="btn ghost" type="button" disabled={busy} onClick={()=>void sync.signOut()}><LogOut size={16}/> Sign out of Mezgeb account</button>}
   <p className="muted">Cloud snapshots are private, revision-controlled financial drafts. They are not officially issued tax receipts. Export JSON backups regularly.</p>
  </section>;
}
