"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLedger } from "./providers";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { type Document, type SyncMeta, readSyncMeta, storeSyncMeta, disconnectSyncAccount, createRecoveryCopy, commitCloudSnapshot, readRecoveryCopies, type RecoveryCopy } from "@/lib/mezgeb";
import { isSameLedger, mergeLedgers, type Conflict } from "@/lib/sync/merge";
import { decideAutoPair } from "@/lib/sync/auto-pair";

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
async function remotePOST(document:Document, expectedRevision:number|null, accountId:string):Promise<Remote>{
 const response=await fetch("/api/cloud",{method:"POST",credentials:"same-origin",
 headers:{"Content-Type":"application/json"},body:JSON.stringify({document,expectedRevision,accountId})});
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
 const [metaLoaded,setMetaLoaded]=useState(false);
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
 const autoAttempt=useRef("");

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
  setMetaLoaded(true);
 },[]);
 useEffect(()=>{if(ready)void refreshMeta().catch(e=>{setStatus("error");setMessage(errMessage(e));});},[ready,refreshMeta]);

 useEffect(()=>{
  if(!activeConfig||!ready)return;
  if(!metaLoaded){setStatus("checking");return;}
  if(!accountId){setStatus("signed-out");return;}
  if(!isVerified){setStatus("unverified");return;}
  if(meta&&meta.accountId!==accountId){setStatus("account-switch");return;}
  if(!meta){setStatus("not-linked");return;}
  if(meta.holdForReview){
    setStatus("conflict");
    setConflictList([{section:"ledger",key:"recovery",reason:"An older financial snapshot was restored. Review before updating cloud records."}]);
    return;
  }
  if(!isOnline()){setStatus("offline");return;}
  if(statusRef.current==="conflict")return;
  setStatus("syncing");
 },[accountId,isVerified,meta,ready,metaLoaded]);

 const sync=useCallback(async()=>{
  if(!activeConfig||!ready||!accountRef.current||lock.current||statusRef.current==="conflict")return;
  const user=accountRef.current;
  const saved=metaRef.current;
  if(!saved||saved.accountId!==user||!isVerified)return;
  if(saved.holdForReview){
    setStatus("conflict");
    setConflictList([{section:"ledger",key:"recovery",reason:"Restored history requires explicit cloud conflict resolution."}]);
    return;
  }
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
      try{newest=await remotePOST(merged.document,remote.revision,user);}
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
    // Financial edits made while the request was in flight must be handled
    // in the next merge cycle rather than overwritten by this one.
    await flush();
    if(!isSameLedger(docRef.current,local)){
      // A request may have successfully uploaded version A while the person
      // edited version B on this device. Persist the server-ACKNOWLEDGED
      // revision as our common ancestor before attempting B. Otherwise the
      // next 3-way merge may mistake A -> B for a concurrent conflict or
      // repeatedly retry an obsolete cloud revision.
      const acknowledged:SyncMeta={
        key:"active",accountId:user,enabled:true,
        revision:newest.revision,base:newest.document,lastSyncedAt:Date.now()
      };
      await storeSyncMeta(acknowledged);
      metaRef.current=acknowledged;setMeta(acknowledged);
      setCloud(newest);setLastSyncedAt(acknowledged.lastSyncedAt);
      setMessage("New edits were saved locally while syncing; sending the latest version next.");
      setStatus("syncing");setTick(n=>n+1);return;
    }
    const mergedForDevice:Document={
      ...merged.document,locale:docRef.current.locale,theme:docRef.current.theme
    };
    const now=Date.now();
    const next:SyncMeta={key:"active",accountId:user,enabled:true,
      revision:newest.revision,base:mergedForDevice,lastSyncedAt:now};
    if(!isSameLedger(local,mergedForDevice)){
      // The ledger and its cloud checkpoint must survive crashes together.
      await commitCloudSnapshot(mergedForDevice,next,docRef.current,
        "Before automatic merge from cloud revision "+remote.revision);
      if(accountRef.current===user&&isSameLedger(docRef.current,local))replace(mergedForDevice,true);
    }else{
      await storeSyncMeta(next);
    }
    metaRef.current=next;
    setMeta(next);setLastSyncedAt(now);
    setCloud(newest);setConflictList([]);setRecovery(await readRecoveryCopies(user));
    if(!isSameLedger(docRef.current,mergedForDevice))setTick(n=>n+1);
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
   if(saved?.accountId===accountId){
     if(saved.holdForReview){
       setConflictList([{section:"ledger",key:"recovery",reason:"You restored historical records; choose which version to keep before syncing again."}]);
       setStatus("conflict");
     }else{setStatus("syncing");setTick(n=>n+1);}
   }
   else{setStatus(saved?"account-switch":"not-linked");}
  }catch(e){setMessage(errMessage(e));setStatus(statusOfError(e,isOnline()));}
 };

 const connect=async(choice:"device"|"cloud",automatic=false)=>{
  const user=accountId;
  if(!user||!isVerified||!ready||!metaLoaded||metaRef.current||lock.current)return;
  lock.current=true;setStatus("syncing");setMessage("");
  try{
    const local=await flush();
    const response=await remoteGET();
    const remote=response.snapshot;
    if(accountRef.current!==user)throw Error("Account changed. Try again.");
    const autoAction=automatic?decideAutoPair(local,remote?.document||null):null;
    if(autoAction==="wait-for-business"){
      setCloud(null);setStatus("not-linked");
      setMessage("Your cloud backup will start automatically when you finish setting up your business.");
      return;
    }
    if(autoAction==="review-different-records"){
      setCloud(remote);setStatus("not-linked");
      setMessage("Both this device and your cloud account contain different financial records. Review which records to use before connecting; neither copy was overwritten.");
      return;
    }
    if(!remote){
      if(!local.business.name.trim())throw Error("Set up a business before enabling cloud sync.");
      const uploaded=await remotePOST(local,null,user);
      if(accountRef.current!==user)throw Error("Account changed during first cloud upload.");
      const next:SyncMeta={key:"active",accountId:user,enabled:true,revision:uploaded.revision,base:local,lastSyncedAt:Date.now()};
      await storeSyncMeta(next);metaRef.current=next;setMeta(next);setCloud(uploaded);
    }else if(choice==="cloud"||autoAction==="restore-empty-device"||autoAction==="link-identical"||isSameLedger(remote.document,local)){
      await flush();
      if(!isSameLedger(docRef.current,local)||accountRef.current!==user)
        throw Error("The account or local ledger changed during linking; retry.");
      const documentForDevice:Document={
        ...remote.document,locale:docRef.current.locale,theme:docRef.current.theme
      };
      const next:SyncMeta={key:"active",accountId:user,enabled:true,
        revision:remote.revision,base:documentForDevice,lastSyncedAt:Date.now()};
      if(!isSameLedger(local,documentForDevice)){
        await commitCloudSnapshot(documentForDevice,next,docRef.current,
          "Before linking cloud records to this device");
        if(accountRef.current===user&&isSameLedger(docRef.current,local))replace(documentForDevice,true);
      }else await storeSyncMeta(next);
      metaRef.current=next;setMeta(next);setCloud(remote);
    }else{
      // A first-time cloud overwrite remains strictly manual. Automatic
      // pairing only uses the safe actions classified above.
      await createRecoveryCopy(remote.document,user,"Cloud records before explicit first-device replacement");
      const uploaded=await remotePOST(local,remote.revision,user);
      const next:SyncMeta={key:"active",accountId:user,enabled:true,revision:uploaded.revision,base:local,lastSyncedAt:Date.now()};
      await storeSyncMeta(next);metaRef.current=next;setMeta(next);setCloud(uploaded);
    }
    // A manual reconnect intentionally turns back on sync after an opt-out.
    if(!automatic){
      try{
        window.localStorage.removeItem("mezgeb.sync.optout."+user);
        window.localStorage.removeItem("mezgeb.sync.previousAccount");
      }catch{}
    }
    setLinkedAccountId(user);setConflictList([]);setLastSyncedAt(Date.now());
    setRecovery(await readRecoveryCopies(user));setStatus("synced");
    if(!isSameLedger(docRef.current,local))setTick(n=>n+1);
  }catch(e){setMessage(errMessage(e));setStatus(statusOfError(e,isOnline()));}
  finally{lock.current=false;}
 };

 // For verified accounts, pair automatically when doing so cannot overwrite
 // different financial ledgers. The cloud is re-read during connect(), so a
 // stale discovery result cannot authorize a destructive upload.
 useEffect(()=>{
   if(!activeConfig||!ready||!metaLoaded||!accountId||!isVerified||meta||!isOnline())return;
   try{
     if(window.localStorage.getItem("mezgeb.sync.optout."+accountId)==="1")return;
     const previous=window.localStorage.getItem("mezgeb.sync.previousAccount");
     if(previous&&previous!==accountId){
       setStatus("not-linked");
       setMessage("This device previously held another account's ledger. Review the data before manually connecting this account; automatic uploading is blocked.");
       return;
     }
   }catch{}
   const key=JSON.stringify([accountId,doc.business.name,doc.business.tin,
     doc.business.phone,doc.entries.length,doc.customers.length,doc.nextDraft]);
   if(autoAttempt.current===key && statusRef.current!=="error" && statusRef.current!=="offline")return;
   autoAttempt.current=key;
   void connect("device",true);
 },[ready,metaLoaded,accountId,isVerified,meta,doc.business.name,
   doc.business.tin,doc.business.phone,doc.entries.length,doc.customers.length,
   doc.nextDraft,tick]);

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
      resolved=await remotePOST(local,latest.snapshot.revision,user);
    }else{
      if(!isSameLedger(docRef.current,local))throw Error("Local ledger changed while resolving. Retry.");
    }
    await flush();
    if(accountRef.current!==user||!isSameLedger(docRef.current,local))
      throw Error("Local ledger changed during conflict resolution. Retry.");
    const resolvedForDevice:Document={
      ...resolved.document,locale:docRef.current.locale,theme:docRef.current.theme
    };
    const next:SyncMeta={key:"active",accountId:user,enabled:true,
      revision:resolved.revision,base:resolvedForDevice,lastSyncedAt:Date.now()};
    if(choice==="cloud"&&!isSameLedger(local,resolvedForDevice)){
      await commitCloudSnapshot(resolvedForDevice,next,docRef.current,
        "Before replacing local records during conflict resolution",true);
      if(accountRef.current===user&&isSameLedger(docRef.current,local))replace(resolvedForDevice,true);
    }else await storeSyncMeta(next,true); // Only a reviewed Keep Cloud/Device action releases a recovery hold.
    metaRef.current=next;setMeta(next);setCloud(resolved);
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
  try{
    window.localStorage.setItem("mezgeb.sync.optout."+linked.accountId,"1");
    window.localStorage.setItem("mezgeb.sync.previousAccount",linked.accountId);
  }catch{}
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
  const user=accountId;
  const checkpoint=metaRef.current;
  if(!user||user!==copy.accountId||!checkpoint||checkpoint.accountId!==user){
    setMessage("This recovery copy is not linked to the signed-in account.");return;
  }
  if(lock.current){setMessage("A cloud operation is already running. Retry once it finishes.");return;}
  lock.current=true;
  try{
    const local=await flush();
    // The reviewed-recovery hold, restored ledger and safety copy MUST be
    // committed in one IndexedDB transaction. A crash can never leave the
    // restored ledger live without the hold or vice versa.
    const paused:SyncMeta={...checkpoint,holdForReview:true};
    await commitCloudSnapshot(copy.document,paused,local,
      "Before restoring saved recovery snapshot");
    metaRef.current=paused;setMeta(paused);
    replace(copy.document,true);
    setRecovery(await readRecoveryCopies(user));
    setConflictList([{section:"ledger",key:"recovery",reason:"A historical ledger was restored. Select Keep Device or Keep Cloud after reviewing both versions."}]);
    setStatus("conflict");
    setMessage("Recovery restored locally. Automatic uploads are paused for review.");
  }catch(e){setStatus("error");setMessage(errMessage(e));}
  finally{lock.current=false;}
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
