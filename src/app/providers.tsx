"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState} from "react";
import {initialDocument,loadDocument,saveDocumentIfUnchanged,type Document} from "@/lib/mezgeb";
type Store={doc:Document;ready:boolean;error:string|null;update:(change:(previous:Document)=>Document)=>void;commit:(change:(previous:Document)=>Document)=>Promise<Document>;replace:(next:Document,alreadyStored?:boolean)=>void;flush:()=>Promise<Document>};
const Context=createContext<Store|null>(null);
export function LedgerProvider({children}:{children:React.ReactNode}){
 const [doc,setDoc]=useState<Document>(initialDocument),[ready,setReady]=useState(false),[error,setError]=useState<string|null>(null);
 const sequence=useRef<Promise<unknown>>(Promise.resolve()),latest=useRef(doc),persisted=useRef<Document|null>(null),storageConflict=useRef<string|null>(null);
 const fail=useCallback((e:unknown)=>{const reason=e instanceof Error?e.message:"Could not save your records.";storageConflict.current=reason;setError(reason);return Error(reason);},[]);
 const persist=useCallback((snapshot:Document)=>{
  const task=sequence.current.then(async()=>{if(storageConflict.current)throw Error(storageConflict.current);const base=persisted.current;if(!base)throw Error("Device ledger was not initialized.");try{await saveDocumentIfUnchanged(snapshot,base);persisted.current=snapshot;setError(null);return snapshot;}catch(e){throw fail(e);}});
  sequence.current=task.catch(()=>{});return task;
 },[fail]);
 useEffect(()=>{let active=true;loadDocument().then(async value=>{if(!active)return;await saveDocumentIfUnchanged(value,value);if(!active)return;persisted.current=value;latest.current=value;setDoc(value);setReady(true);}).catch(e=>{if(active)fail(e);});return()=>{active=false;};},[fail]);
 useEffect(()=>{if(!ready)return;document.documentElement.dataset.theme=doc.theme;document.querySelector('meta[name="theme-color"]')?.setAttribute("content",doc.theme==="dark"?"#191a32":"#e0e5fb");document.documentElement.lang=doc.locale;document.documentElement.dir=doc.locale==="ar"?"rtl":"ltr";},[doc,ready]);
 const commit=useCallback((change:(previous:Document)=>Document)=>{if(storageConflict.current)return Promise.reject(Error(storageConflict.current));if(!persisted.current)return Promise.reject(Error("Device ledger was not initialized."));try{const next={...change(latest.current),updatedAt:Date.now()};latest.current=next;setDoc(next);return persist(next);}catch(e){return Promise.reject(e);}},[persist]);
 const update=useCallback((change:(previous:Document)=>Document)=>{void commit(change).catch(e=>setError(e instanceof Error?e.message:"Could not save changes."));},[commit]);
 const replace=useCallback((next:Document,alreadyStored=false)=>{if(storageConflict.current)throw Error(storageConflict.current);if(alreadyStored)persisted.current=next;const value={...next,updatedAt:Date.now()};latest.current=value;setDoc(value);void persist(value).catch(()=>{});},[persist]);
 const flush=useCallback(()=>persist(latest.current),[persist]);
 return <Context.Provider value={{doc,ready,error,update,commit,replace,flush}}>{children}</Context.Provider>;
}
export function useLedger(){const store=useContext(Context);if(!store)throw Error("useLedger must be inside LedgerProvider");return store;}
