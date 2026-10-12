"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLedger } from "./providers";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { type Document, type SyncMeta, readSyncMeta, storeSyncMeta, disconnectSyncAccount, createRecoveryCopy, readRecoveryCopies, type RecoveryCopy } from "@/lib/mezgeb";
import { isSameLedger, mergeLedgers, type Conflict } from "@/lib/sync/merge";

export type SyncStatus =
  "unconfigured" | "checking" | "signed-out" | "unverified" | "not-linked" |
  "account-switch" | "offline" | "syncing" | "synced" | "conflict" | "error";
type CloudReply = { business: string|null; snapshot:{document:Document;revision:number;updatedAt:string}|null; error?:string };
type Remote = NonNullable<CloudReply["snapshot"]>;
type SyncContextValue = {
  status: SyncStatus; email: string|null; message:string; conflictList:Conflict[];
  cloud:Remote|null; accountId:string|null; linkedAccountId:string|null;
  lastSyncedAt:number|null; recovery:RecoveryCopy[];
  refresh:()=>Promise<void>; connect:(choice:"device"|"cloud")=>Promise<void>;
  resolve:(choice:"device"|"cloud")=>Promise<void>;
  disconnect:()=>Promise<void>; signOut:()=>Promise<void>;
  recover:(copy:RecoveryCopy)=>Promise<void>;
};
const Context=createContext<SyncContextValue|null>(null);
const activeConfig=Boolean(getSupabaseConfig());
function errMessage(e:unknown){return e instanceof Error?e.message:"Cloud is unavailable; local records were retained.";}
function isOnline(){return typeof navigator!=="undefined" && navigator.onLine!==false;}
async function remoteGET():Promise<CloudReply>{
 const response=await fetch("/api/cloud",{credentials:"same-origin",cache:"no-store"});
 const payload=await response.json() as CloudReply;
 if(!response.ok){const error=new Error(payload.error||"Could not contact cloud.");(error as Error & {status:number}).status=response.status;throw error;}
 return payload;
}
async function remotePOST(document:Document, expectedRevision:number|null):Promise<Remote>{
 const response=await fetch("/api/cloud",{method:"POST",credentials:"same-origin",
 headers:{"Content-Type":"application/json"},body:JSON.stringify({document,expectedRevision})});
 const result=await response.json() as {revision?:number;updatedAt?:string;error?:string};
 if(!response.ok){const error=new Error(result.error||"Cloud upload failed.");(error as Error & {status:number}).status=response.status;throw error;}
 if(!result.revision||!result.updatedAt)throw new Error("Server did not confirm a revision.");
 return {document,revision:result.revision,updatedAt:result.updatedAt};
}
const statusOfError=(e:unknown,connected:boolean):SyncStatus=>{
 if(!connected)return "offline";
 return (e as {status?:number})?.status===401?"signed-out":"error";
};
export function SyncProvider({children}:{children:React.ReactNode}){
 const {doc,ready,replace,flush}=useLedger();
 const [status,setStatus]=useState<SyncStatus>(activeConfig?"checking":"unconfigured");
 const [email,setEmail]=useState<string|null>(null);
 const [accountId,setAccountId]=useState<string|null>(null);
 const [linkedAccountId,setLinkedAccountId]=useState<string|null>(null);
 const [meta,setMeta]=useState<SyncMeta|null>(null);
 const [cloud,setCloud]=useState<Remote|null>(null);
 const [lastSyncedAt,setLastSyncedAt]=useState<number|null>(null);
 const [conflictList,setConflictList]=useState<Conflict[]>([]);
 const [message,setMessage]=useState("");
 const [recovery,setRecovery]=useState<RecoveryCopy[]>([]);
 const [tick,setTick]=useState(0);
 const [isVerified,setIsVerified]=useState(false);
 const docRef=useRef(doc);docRef.current=doc;
 const accountRef=useRef<string|null>(null);accountRef.current=accountId;
 const metaRef=useRef<SyncMeta|null>(null);metaRef.current=meta;
 const cloudRef=useRef<Remote|null>(null);cloudRef.current=cloud;
 const statusRef=useRef(status);statusRef.current=status;
 const lock=useRef(false);
 const generation=useRef(0);

 const refreshIdentity=useCallback(async()=>{
  if(!activeConfig)return;
  try{
    const {data,error}=await createClient().auth.getUser();
    const user=error?null:data.user;
    if(!user){setAccountId(null);setEmail(null);setIsVerified(false);setStatus("signed-out");return;}
    setAccountId(user.id);
    setEmail(user.email||null);
    setIsVerified(Boolean(user.email_confirmed_at||user.confirmed_at));
  }catch{
    setStatus(isOnline()?"error":"offline");
  }
 },[]);
 useEffect(()=>{
  if(!activeConfig)return;
  let live=true;
  void refreshIdentity();
  const {data}=createClient().auth.onAuthStateChange(()=>{
    // Auth callbacks must not synchronously await Supabase API operations.
    setTimeout(()=>{if(live)void refreshIdentity();},0);
  });
  return ()=>{live=false;data.subscription.unsubscribe();};
 },[refreshIdentity]);

 const refreshMeta=useCallback(async()=>{
  const saved=await readSyncMeta();
  setMeta(saved);
  setLinkedAccountId(saved?.accountId||null);
  setLastSyncedAt(saved?.lastSyncedAt||null);
  if(saved)setRecovery(await readRecoveryCopies(saved.accountId));
 },[]);
 useEffect(()=>{if(ready)void refreshMeta().catch(e=>{setStatus("error");setMessage(errMessage(e));});},[ready,refreshMeta]);

 useEffect(()=>{
  if(!activeConfig||!ready)return;
  if(!accountId){setStatus("signed-out");return;}
  if(!isVerified){setStatus("unverified");return;}
  if(meta&&meta.accountId!==accountId){setStatus("account-switch");return;}
  if(!meta){setStatus("not-linked");return;}
  if(!isOnline()){setStatus("offline");return;}
  if(statusRef.current==="conflict")return;
  setStatus("syncing");
 },[accountId,isVerified,meta,ready]);

 const sync=useCallback(async()=>{
  if(!activeConfig||!ready||!accountRef.current||lock.current||statusRef.current==="conflict")return;
  const user=accountRef.current;
  const saved=metaRef.current;
  if(!saved||saved.accountId!==user||!isVerified)return;
  if(!isOnline()){setStatus("offline");return;}
  lock.current=true;
  const currentRun=++generation.current;
  setStatus("syncing");setMessage("");
  try{
    const local=await flush();
    if(accountRef.current!==user)return;
    const response=await remoteGET();
    if(accountRef.current!==user)return;
    const remote=response.snapshot;
    if(!remote){
      setStatus("conflict");setConflictList([{section:"ledger",key:"missing-cloud",reason:"Previously linked cloud backup disappeared; no automatic upload will recreate it."}]);
      return;
    }
    const merged=mergeLedgers(saved.base,local,remote.document);
    setCloud(remote);
    if(!merged.ok){setConflictList(merged.conflicts);setStatus("conflict");return;}
    let newest=remote;
    if(!isSameLedger(merged.document,remote.document)){
      try{newest=await remotePOST(merged.document,remote.revision);}
      catch(e){
        if((e as {status?:number})?.status===409){
          setMessage("The cloud changed during upload; retrying safely.");
          setStatus("error");
          setTimeout(()=>setTick(x=>x+1),2000);
          return;
        }
        throw e;
      }
    }
    if(accountRef.current!==user||currentRun!==generation.current)return;
    const now=Date.now();
    const next:SyncMeta={key:"active",accountId:user,enabled:true,
      revision:newest.revision,base:merged.document,lastSyncedAt:now};
    await storeSyncMeta(next);
    metaRef.current=next;
    setMeta(next);setLastSyncedAt(now);
    setCloud(newest);setConflictList([]);
    // The user may have entered a transaction during network IO; never replace
    // that newer local state, because it has not been incorporated in this merge.
    if(isSameLedger(docRef.current,local)){
      if(!isSameLedger(docRef.current,merged.document)){
        await createRecoveryCopy(local,user,"Before automatic merge from cloud revision "+remote.revision);
        if(accountRef.current===user&&isSameLedger(docRef.current,local))replace(merged.document);
      }
    }else{
      setTick(n=>n+1);
    }
    setStatus("synced");setMessage("");
  }catch(e){
    setStatus(statusOfError(e,isOnline()));
    setMessage(errMessage(e));
  }finally{lock.current=false;}
 },[ready,flush,replace,isVerified]);

 useEffect(()=>{
  if(!ready||!meta||!accountId||meta.accountId!==accountId||!isVerified)return;
  if(status==="conflict"||status==="account-switch")return;
  const timeout=setTimeout(()=>{void sync();},1400);
  return ()=>clearTimeout(timeout);
 },[doc,ready,accountId,isVerified,meta?.revision,tick,sync,status==="conflict"]);

 useEffect(()=>{
  if(!activeConfig)return;
  const onConnect=()=>{void refreshIdentity();setTick(n=>n+1);};
  const off=()=>setStatus("offline");
  const focus=()=>{if(document.visibilityState==="visible"){void refreshIdentity();setTick(n=>n+1);}};
  const id=setInterval(()=>setTick(n=>n+1),45000);
  window.addEventListener("online",onConnect);window.addEventListener("offline",off);
  document.addEventListener("visibilitychange",focus);window.addEventListener("focus",onConnect);
  return ()=>{clearInterval(id);window.removeEventListener("online",onConnect);window.removeEventListener("offline",off);document.removeEventListener("visibilitychange",focus);window.removeEventListener("focus",onConnect);};
 },[refreshIdentity]);

 const refresh=async()=>{
  if(!accountId||!isVerified){await refreshIdentity();return;}
  try{setStatus("checking");const r=await remoteGET();setCloud(r.snapshot);
   const saved=await readSyncMeta();setMeta(saved);
   if(saved?.accountId===accountId){setStatus("syncing");setTick(n=>n+1);}
   else{setStatus(saved?"account-switch":"not-linked");}
  }catch(e){setMessage(errMessage(e));setStatus(statusOfError(e,isOnline()));}
 };

 const connect=async(choice:"device"|"cloud")=>{
  const user=accountId;
  if(!user||!isVerified||!ready||metaRef.current||lock.current)return;
  lock.current=true;setStatus("syncing");setMessage("");
  try{
    const local=await flush();
    const response=await remoteGET();
    const remote=response.snapshot;
    if(accountRef.current!==user)throw Error("Account changed. Try again.");
    if(!remote){
      if(!local.business.name.trim())throw Error("Set up a business before enabling cloud sync.");
      const uploaded=await remotePOST(local,null);
      const next:SyncMeta={key:"active",accountId:user,enabled:true,revision:uploaded.revision,base:local,lastSyncedAt:Date.now()};
      await storeSyncMeta(next);metaRef.current=next;setMeta(next);setCloud(uploaded);
    }else if(choice==="cloud"||isSameLedger(remote.document,local)){
      if(!isSameLedger(local,remote.document)){
        await createRecoveryCopy(local,user,"Before linking cloud records to this device");
        if(!isSameLedger(docRef.current,local))throw Error("A local record changed while linking; retry.");
        replace(remote.document);
      }
      const next:SyncMeta={key:"active",accountId:user,enabled:true,revision:remote.revision,base:remote.document,lastSyncedAt:Date.now()};
      await storeSyncMeta(next);metaRef.current=next;setMeta(next);setCloud(remote);
    }else{
      // First-time overwrite is explicit, never a side effect of sign-in.
      await createRecoveryCopy(remote.document,user,"Cloud records before explicit first-device replacement");
      const uploaded=await remotePOST(local,remote.revision);
      const next:SyncMeta={key:"active",accountId:user,enabled:true,revision:uploaded.revision,base:local,lastSyncedAt:Date.now()};
      await storeSyncMeta(next);metaRef.current=next;setMeta(next);setCloud(uploaded);
    }
    setLinkedAccountId(user);setConflictList([]);setLastSyncedAt(Date.now());
    setRecovery(await readRecoveryCopies(user));setStatus("synced");
    if(!isSameLedger(docRef.current,local))setTick(n=>n+1);
  }catch(e){setMessage(errMessage(e));setStatus(statusOfError(e,isOnline()));}
  finally{lock.current=false;}
 };

 const resolve=async(choice:"device"|"cloud")=>{
  const user=accountId;if(!user||!metaRef.current||!cloudRef.current||lock.current)return;
  const cloudSnapshot=cloudRef.current;lock.current=true;setStatus("syncing");
  try{
    const local=await flush();
    const latest=await remoteGET();
    if(!latest.snapshot||latest.snapshot.revision!==cloudSnapshot.revision){
      setCloud(latest.snapshot);throw Error("Cloud changed again. Refresh and review conflicts before resolving.");
    }
    await createRecoveryCopy(local,user,"Before resolving sync conflict: local version");
    await createRecoveryCopy(latest.snapshot.document,user,"Before resolving sync conflict: cloud version");
    let resolved:Remote=latest.snapshot;
    if(choice==="device"){
      if(!isSameLedger(docRef.current,local))throw Error("Local ledger changed while resolving. Retry.");
      resolved=await remotePOST(local,latest.snapshot.revision);
    }else{
      if(!isSameLedger(docRef.current,local))throw Error("Local ledger changed while resolving. Retry.");
      replace(latest.snapshot.document);
    }
    const next:SyncMeta={key:"active",accountId:user,enabled:true,
      revision:resolved.revision,base:resolved.document,lastSyncedAt:Date.now()};
    await storeSyncMeta(next);metaRef.current=next;setMeta(next);setCloud(resolved);
    setConflictList([]);setStatus("synced");setLastSyncedAt(next.lastSyncedAt);
    setRecovery(await readRecoveryCopies(user));setMessage("Conflict resolved. Both versions were retained as recovery copies.");
  }catch(e){setMessage(errMessage(e));setStatus("conflict");}
  finally{lock.current=false;}
 };

 const disconnect=async()=>{
  const linked=metaRef.current;
  if(!linked)return;
  // Recovery history belongs to the account previously paired to this device,
  // not any new identity that happens to have signed in afterward.
  await createRecoveryCopy(await flush(),linked.accountId,"Before unlinking cloud sync");
  await disconnectSyncAccount();
  setMeta(null);metaRef.current=null;setLinkedAccountId(null);setCloud(null);
  setStatus("not-linked");setMessage("Automatic synchronization disabled. Local financial records remain on this device.");
 };
 const signOut=async()=>{
  await createClient().auth.signOut();
  setAccountId(null);setIsVerified(false);setEmail(null);
  setStatus("signed-out");setMessage("Signed out. Sync paused; local records remain.");
 };
 const recover=async(copy:RecoveryCopy)=>{
  const user=accountId;if(!user||user!==copy.accountId)throw Error("Recovery copy is tied to a different account.");
  await createRecoveryCopy(await flush(),user,"Before restoring saved recovery snapshot");
  replace(copy.document);
  setMessage("Recovery copy restored locally. Auto-sync will check for conflicts before uploading.");
  setTick(n=>n+1);
 };

 return <Context.Provider value={{status,email,accountId,linkedAccountId,lastSyncedAt,
  message,cloud,conflictList,recovery,refresh,connect,resolve,disconnect,signOut,recover}}>
   {children}
 </Context.Provider>;
}
export function useSync(){
 const value=useContext(Context);
 if(!value)throw Error("SyncProvider missing.");
 return value;
}
